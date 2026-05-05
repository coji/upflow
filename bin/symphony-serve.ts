/**
 * Symphony HTTP server — designed for a Fly machine with auto-start /
 * app-controlled shutdown.
 *
 * - Listens on `PORT` (default 8080) and exposes a single `POST /tick`
 *   endpoint, gated by a bearer token.
 * - Each tick synchronously processes one `symphony:ready` issue
 *   (full takt run inside the same machine, no remote exec). The Fly
 *   proxy sees the long HTTP request as continuous activity and won't
 *   try to stop the machine mid-run.
 * - Concurrency is enforced server-side: a second tick request while one
 *   is in flight returns 200 with `state=busy` rather than queueing.
 * - When idle (no active job and no recent ticks), the process exits
 *   after IDLE_SHUTDOWN_MS so Fly bills nothing while no work is queued.
 *   The next inbound /tick auto-starts the machine.
 *
 * Auth, repo state, and CLI binaries live on the persistent Fly Volume
 * mounted at /data; this server treats them as preconditions and assumes
 * `infra/symphony/entrypoint.sh` has already prepared them.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import {
  type IncomingMessage,
  type ServerResponse,
  createServer,
} from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getErrorMessageForLog } from '~/app/libs/error-message'
import {
  BUDGET_MS,
  type IssueRef,
  LABEL,
  TAKT_WORKFLOW,
  type TaktMetaStatus,
  type TaktOutcome,
  classifyTakt,
  elapsedMarker,
  ghAddLabel,
  ghComment,
  ghIssueList,
  ghRemoveLabel,
  parseFiniteNumberEnv,
  readLatestJsonlEvent,
  run,
  usedBudgetMs,
} from './symphony-shared'

dayjs.extend(utc)

const PORT = parseFiniteNumberEnv('PORT', {
  fallback: 8080,
  min: 1,
  max: 65535,
})
const REPO_DIR = process.env.SYMPHONY_REPO_DIR ?? join(homedir(), 'upflow')
const TICK_TOKEN = process.env.SYMPHONY_TICK_TOKEN
const IDLE_SHUTDOWN_MS = parseFiniteNumberEnv('SYMPHONY_IDLE_SHUTDOWN_MS', {
  fallback: 5 * 60 * 1000,
  min: 1000,
})

if (!TICK_TOKEN) {
  console.error('[fatal] SYMPHONY_TICK_TOKEN env is required')
  process.exit(1)
}

interface JobProgress {
  /** Filled in once the takt subprocess has created its `.takt/runs/...` dir. */
  taktRunDir: string | null
  /** Most recent stdout line from the active subprocess (preflight or takt). */
  lastStdoutLine: string | null
  /** When this server received `lastStdoutLine` (our clock, ISO 8601 UTC). */
  lastStdoutAt: string | null
  /** Most recent event type from the takt session jsonl, polled periodically. */
  lastEventType: string | null
  /** Timestamp recorded INSIDE the jsonl event by takt (not poll time). */
  lastEventAt: string | null
}

interface JobState {
  issueNumber: number
  startedAt: string
  child: ChildProcess | null
  progress: JobProgress
}

let activeJob: JobState | null = null
let idleTimer: NodeJS.Timeout | null = null
let progressPoller: NodeJS.Timeout | null = null

const PROGRESS_POLL_MS = parseFiniteNumberEnv('SYMPHONY_PROGRESS_POLL_MS', {
  fallback: 30 * 1000,
  min: 1000,
})

function updateActiveJobLine(line: string): void {
  if (activeJob === null) return
  activeJob.progress.lastStdoutLine = line
  activeJob.progress.lastStdoutAt = dayjs.utc().toISOString()
}

function scheduleIdleShutdown(): void {
  if (idleTimer !== null) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (activeJob !== null) return
    console.log(
      '[shutdown] idle timeout reached, exiting so Fly stops the machine',
    )
    process.exit(0)
  }, IDLE_SHUTDOWN_MS)
  idleTimer.unref()
}

function cancelIdleShutdown(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

function findLatestRunDir(startedAtMs: number): string | null {
  const runsRoot = join(REPO_DIR, '.takt', 'runs')
  if (!existsSync(runsRoot)) return null
  const candidates = readdirSync(runsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const full = join(runsRoot, d.name)
      const meta = join(full, 'meta.json')
      const mtime = existsSync(meta) ? statSync(meta).mtimeMs : 0
      return { full, mtime }
    })
    .filter((c) => c.mtime >= startedAtMs - 5_000)
    .sort((a, b) => b.mtime - a.mtime)
  return candidates[0]?.full ?? null
}

interface TaktMeta {
  status: TaktMetaStatus
  iterations?: number
}

function readMeta(runDir: string): TaktMeta | null {
  const path = join(runDir, 'meta.json')
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as TaktMeta
  } catch {
    return null
  }
}

function readSuperviseReport(runDir: string): string {
  const path = join(runDir, 'reports', 'supervise-report.md')
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf-8')
}

function pollProgress(): void {
  if (activeJob === null) return
  try {
    const startMs = dayjs.utc(activeJob.startedAt).valueOf()
    if (activeJob.progress.taktRunDir === null) {
      activeJob.progress.taktRunDir = findLatestRunDir(startMs)
    }
    const runDir = activeJob.progress.taktRunDir
    if (runDir === null) return
    const ev = readLatestJsonlEvent(runDir)
    if (ev === null) return
    activeJob.progress.lastEventType = ev.type
    activeJob.progress.lastEventAt = ev.timestamp
  } catch (e) {
    // Don't let a transient FS race (takt rotated logs, Volume hiccup,
    // malformed JSON line) take down the interval loop. Next tick retries.
    console.warn('[progress] poll failed:', getErrorMessageForLog(e))
  }
}

function startProgressPoller(): void {
  if (progressPoller !== null) return
  progressPoller = setInterval(pollProgress, PROGRESS_POLL_MS)
  progressPoller.unref()
}

function stopProgressPoller(): void {
  if (progressPoller === null) return
  clearInterval(progressPoller)
  progressPoller = null
}

interface TaktChildResult {
  metaStatus: TaktMetaStatus
  superviseReport: string
  elapsedMs: number
  iterations?: number
  /** Names the failing preflight stage when metaStatus === 'preflight_failed'. */
  preflightFailedAt?: string
}

async function runTakt(issueNumber: number): Promise<TaktChildResult> {
  const startMs = Date.now()
  // Preflight: pristine main + deterministic env setup. We used to delegate
  // this to a takt `bootstrapper` persona that ran the same three commands
  // through claude-opus, but the LLM's per-turn thinking gaps reliably
  // tripped Claude CLI's stream-idle timeout (issue #394). Running it as
  // straight bash here is faster, cheaper, and removes a class of failures.
  // Splitting preflight from the takt invocation also lets us return a
  // distinct `preflight_failed` metaStatus instead of the generic
  // `startup_failed` so the post-mortem comment names the real cause.
  //
  // Each preflight stage is its own bash invocation so we can name the
  // failing stage in the post-mortem comment instead of forcing operators
  // to grep Fly logs to find which command broke. The 4 spawn overhead
  // (~50-100ms each) is negligible vs the actual command runtime.
  const preflightStages: Array<[string, string]> = [
    [
      'git sync',
      [
        `cd ${REPO_DIR}`,
        'git fetch --quiet origin main',
        'git checkout main --quiet',
        'git reset --hard origin/main --quiet',
        'git clean -fd --quiet',
      ].join(' && '),
    ],
    [
      'pnpm install',
      `cd ${REPO_DIR} && pnpm install --frozen-lockfile --silent`,
    ],
    ['pnpm db:setup', `cd ${REPO_DIR} && pnpm db:setup`],
    ['pnpm typecheck', `cd ${REPO_DIR} && pnpm typecheck`],
  ]
  for (const [stage, cmd] of preflightStages) {
    const r = await run('bash', ['-lc', cmd], {
      streamPrefix: `[preflight:${stage}] `,
      captureOutput: false,
      onChild: (child) => {
        if (activeJob !== null) activeJob.child = child
      },
      onStdoutLine: updateActiveJobLine,
    })
    if (r.code !== 0) {
      return {
        metaStatus: 'preflight_failed',
        superviseReport: '',
        elapsedMs: Date.now() - startMs,
        preflightFailedAt: stage,
      }
    }
  }

  const taktCmd = `cd ${REPO_DIR} && takt --pipeline -i ${issueNumber} -w ${TAKT_WORKFLOW}`
  const r = await run('bash', ['-lc', taktCmd], {
    streamPrefix: '[takt] ',
    captureOutput: false,
    onChild: (child) => {
      if (activeJob !== null) activeJob.child = child
    },
    onStdoutLine: updateActiveJobLine,
  })
  const elapsedMs = Date.now() - startMs
  const runDir = findLatestRunDir(startMs)
  if (runDir === null) {
    return { metaStatus: 'startup_failed', superviseReport: '', elapsedMs }
  }
  const meta = readMeta(runDir)
  const status: TaktMetaStatus =
    meta?.status ?? (r.code === 0 ? 'completed' : 'failed')
  return {
    metaStatus: status,
    superviseReport: status === 'completed' ? readSuperviseReport(runDir) : '',
    elapsedMs,
    iterations: meta?.iterations,
  }
}

async function processOneIssue(): Promise<{
  state: 'idle' | 'processed'
  issue?: number
  outcome?: TaktOutcome['outcome']
}> {
  const ready = await ghIssueList(LABEL.ready)
  if (ready.length === 0) return { state: 'idle' }
  const issue: IssueRef = ready[0]

  const startedAt = dayjs.utc().toISOString()
  activeJob = {
    issueNumber: issue.number,
    startedAt,
    child: null,
    progress: {
      taktRunDir: null,
      lastStdoutLine: null,
      lastStdoutAt: null,
      lastEventType: null,
      lastEventAt: null,
    },
  }
  startProgressPoller()
  console.log(`[pick] #${issue.number} ${issue.title}`)

  // try/finally so activeJob always clears even when a gh / takt call
  // throws mid-processing. Without this, a partial failure would leave
  // the runner permanently "busy" and ignore every subsequent /tick.
  try {
    const used = await usedBudgetMs(issue.number)
    const remainingMs = BUDGET_MS - used
    if (remainingMs <= 0) {
      await ghComment(
        issue.number,
        [
          '🤖 symphony: budget exceeded, marking as failed',
          `- used: ${Math.round(used / 60000)} min / ${BUDGET_MS / 60000} min`,
          '- re-add `symphony:ready` after addressing the underlying issue to retry',
        ].join('\n'),
      )
      await ghRemoveLabel(issue.number, LABEL.ready)
      await ghAddLabel(issue.number, LABEL.failed)
      return {
        state: 'processed',
        issue: issue.number,
        outcome: 'failure_deterministic',
      }
    }

    await ghRemoveLabel(issue.number, LABEL.ready)
    await ghAddLabel(issue.number, LABEL.running)
    await ghComment(
      issue.number,
      [
        `🤖 symphony attempt starting at ${startedAt}`,
        `- workflow: ${TAKT_WORKFLOW}`,
        `- runner: fly machine`,
        `- budget remaining: ${Math.round(remainingMs / 60000)} min`,
      ].join('\n'),
    )

    let taktResult: TaktChildResult
    try {
      taktResult = await runTakt(issue.number)
    } catch (e) {
      console.error('[error] takt subprocess threw:', getErrorMessageForLog(e))
      taktResult = {
        metaStatus: 'failed',
        superviseReport: '',
        elapsedMs: Date.now() - dayjs.utc(startedAt).valueOf(),
      }
    }

    const result = classifyTakt(taktResult)
    const finishedAt = dayjs.utc().toISOString()
    const nextLabel =
      result.outcome === 'success' ? LABEL.inReview : LABEL.failed
    await ghRemoveLabel(issue.number, LABEL.running)
    await ghAddLabel(issue.number, nextLabel)
    await ghComment(
      issue.number,
      [
        `🤖 symphony attempt complete at ${finishedAt}`,
        `- outcome: ${result.outcome}`,
        `- elapsed: ${Math.round(result.elapsedMs / 60000)} min`,
        `- next label: ${nextLabel}`,
        `- reason: ${result.reason}`,
        '',
        elapsedMarker(result.elapsedMs),
      ].join('\n'),
    )
    console.log(`[done] #${issue.number} → ${nextLabel} (${result.outcome})`)
    return { state: 'processed', issue: issue.number, outcome: result.outcome }
  } finally {
    stopProgressPoller()
    activeJob = null
  }
}

/**
 * On boot, transition any orphaned `symphony:running` issue to `failed`.
 * Without this the running guard would block forever after a crash.
 */
async function reconcileOrphans(): Promise<void> {
  const orphans = await ghIssueList(LABEL.running)
  for (const issue of orphans) {
    console.log(`[orphan] #${issue.number} was left running, marking failed`)
    await ghComment(
      issue.number,
      [
        '🤖 symphony: previous attempt did not complete (machine restart or crash)',
        '- transitioning to failed (transient reason)',
        '- re-add `symphony:ready` to retry',
      ].join('\n'),
    )
    await ghRemoveLabel(issue.number, LABEL.running)
    await ghAddLabel(issue.number, LABEL.failed)
  }
}

function unauthorized(res: ServerResponse): void {
  res.writeHead(401, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'unauthorized' }))
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not_found' }))
}

async function handleTick(res: ServerResponse): Promise<void> {
  cancelIdleShutdown()
  if (activeJob !== null) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        state: 'busy',
        issue: activeJob.issueNumber,
        startedAt: activeJob.startedAt,
      }),
    )
    return
  }
  try {
    const result = await processOneIssue()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (e) {
    console.error('[error] tick handler failed:', getErrorMessageForLog(e))
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error: 'tick_failed',
        message: getErrorMessageForLog(e),
      }),
    )
  } finally {
    scheduleIdleShutdown()
  }
}

function handleStatus(res: ServerResponse): void {
  // Build a serialisable view of activeJob explicitly. Returning the raw
  // JobState would dump the underlying ChildProcess into the response.
  const job = activeJob
  const safeJob =
    job === null
      ? null
      : {
          issueNumber: job.issueNumber,
          startedAt: job.startedAt,
          elapsedMs: Date.now() - dayjs.utc(job.startedAt).valueOf(),
          pid: job.child?.pid ?? null,
          taktRunDir: job.progress.taktRunDir,
          lastStdoutLine: job.progress.lastStdoutLine,
          lastStdoutAt: job.progress.lastStdoutAt,
          lastEventType: job.progress.lastEventType,
          lastEventAt: job.progress.lastEventAt,
        }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify({
      state: job === null ? 'idle' : 'busy',
      activeJob: safeJob,
      bootAt: BOOT_AT,
    }),
  )
}

async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.headers.authorization !== `Bearer ${TICK_TOKEN}`) {
    return unauthorized(res)
  }
  if (req.method === 'POST' && req.url === '/tick') {
    await handleTick(res)
    return
  }
  if (req.method === 'GET' && req.url === '/status') {
    handleStatus(res)
    return
  }
  notFound(res)
}

const BOOT_AT = dayjs.utc().toISOString()

console.log(`[boot] symphony-serve starting at ${BOOT_AT}`)
console.log(`[boot] repo dir: ${REPO_DIR}`)
console.log(`[boot] idle shutdown: ${IDLE_SHUTDOWN_MS / 60000} min`)
console.log(`[boot] budget per issue: ${BUDGET_MS / 60000} min`)

reconcileOrphans().catch((e) => {
  console.error(
    '[error] reconcileOrphans failed:',
    e instanceof Error ? e.message : e,
  )
})

const server = createServer((req, res) => {
  handler(req, res).catch((e) => {
    console.error('[error] unhandled:', e instanceof Error ? e.message : e)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'unhandled' }))
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[ready] listening on 0.0.0.0:${PORT}`)
  scheduleIdleShutdown()
})

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    console.log(`[signal] ${sig} received, shutting down`)
    const job = activeJob
    if (
      job?.child !== undefined &&
      job?.child !== null &&
      job.child.exitCode === null
    ) {
      console.log(
        `[signal] forwarding SIGTERM to takt child pid=${job.child.pid}`,
      )
      job.child.kill('SIGTERM')
      setTimeout(() => {
        if (job.child !== null && job.child.exitCode === null) {
          job.child.kill('SIGKILL')
        }
      }, 10_000).unref()
    }
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 30_000).unref()
  })
}
