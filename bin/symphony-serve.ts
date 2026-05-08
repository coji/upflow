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
import { match } from 'ts-pattern'
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
  formatDeliveryCommitMessage,
  formatDeliveryPrBody,
  ghAddLabel,
  ghComment,
  ghIssueList,
  ghRemoveLabel,
  isValidTaktBranch,
  parseFiniteNumberEnv,
  readLatestJsonlEvent,
  run,
  runError,
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

function readImplementReport(runDir: string): string {
  // Both the implement and fix steps declare `name: implement-report.md`
  // in their output_contracts. takt's report-phase-runner backs up any
  // existing file at this name to `<name>.<timestamp>` before writing
  // (see `backupExistingReport` in report-phase-runner.ts), so the base
  // name always holds the most recent attempt. classifyTakt only
  // consults this report on aborted runs, where the latest implement /
  // fix attempt is exactly what we want.
  const path = join(runDir, 'reports', 'implement-report.md')
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
  implementReport: string
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
  //
  // Stages MUST stay in lockstep with `infra/symphony/preflight-local.sh`,
  // which runs the same chain locally for pre-deploy verification. There's
  // no shared definition yet — keep the two arrays manually in sync.
  // Exception: `cursor state reset` only matters on the persistent fly
  // volume, not in the throwaway local preflight container, so it lives
  // here only.
  const preflightStages: Array<[string, string]> = [
    // cursor-agent's composer model retrieves prompts from its
    // persistent project memory under `$HOME/.cursor/` when composing
    // subagent tasks. Stale sessions left over from prior symphony
    // runs or manual SSH testing leak in as subagent prompts and
    // trigger out-of-scope edits (observed on issue #399). Cursor
    // exposes no CLI flag or config option to disable subagent project
    // memory (verified against cursor.com/docs/cli and
    // cursor.com/docs/subagents), so we have to manage the state file
    // tree ourselves before each takt run.
    //
    // Archive (not delete) the active dirs into a timestamped sibling
    // so cursor sees an empty starting state but we keep forensic
    // transcripts for post-mortem inspection. Bound disk usage by
    // pruning archives beyond the most recent 10. Side effect: any
    // ongoing manual SSH cursor session loses its scratch state when
    // a tick fires.
    //
    // The `data-upflow` literal in the projects path is cursor's own
    // slug for the workspace (slashes in `/data/upflow` collapsed to
    // dashes). If SYMPHONY_REPO_DIR ever moves, this slug changes and
    // the mv silently misses — re-derive then.
    [
      'cursor state reset',
      // Joined with `;` (not `&&` like sibling stages) because each
      // step is independently optional: source dirs may not exist on
      // first boot, prune may have nothing to remove. Trailing `true`
      // pins the stage exit to 0 so a stray `rm` failure on an
      // unreadable archive doesn't fail preflight.
      [
        'ARCHIVE_ROOT=$HOME/.cursor/_archive',
        'ARCHIVE=$ARCHIVE_ROOT/$(date -u +%Y%m%dT%H%M%SZ)',
        'mkdir -p "$ARCHIVE"',
        'mv $HOME/.cursor/chats "$ARCHIVE/" 2>/dev/null',
        'mv $HOME/.cursor/projects/data-upflow/agent-transcripts "$ARCHIVE/" 2>/dev/null',
        'mkdir -p $HOME/.cursor/chats $HOME/.cursor/projects/data-upflow/agent-transcripts',
        'ls -dt $ARCHIVE_ROOT/*/ 2>/dev/null | tail -n +11 | xargs -r rm -rf',
        'true',
      ].join('; '),
    ],
    // cursor-agent's auto-update flow downloads newer versions to
    // `$HOME/.local/share/cursor-agent/versions/<ver>/cursor-agent` and
    // immediately spawns `<that binary> cleanup-install-versions <ver>`
    // as a detached child. The child is supposed to remove stale
    // version dirs deterministically but in practice falls through to
    // LLM agent mode with the args as a user prompt. The composer
    // model then edits Dockerfile / docs trying to "complete" what it
    // reads as a versioning task — see issue #399.
    //
    // The Dockerfile-pinned binary (/opt/...) is shimmed at build
    // time. Auto-installed copies in HOME need the same shim re-applied
    // each tick: a `for` loop hits any version dir cursor has dropped,
    // saves the real binary as `cursor-agent.real` if not already, and
    // overwrites the entry point with our shim. Idempotent via the
    // SHIM_VERSION marker in cursor-agent-shim.sh.
    [
      'cursor-agent shim',
      // Fail fast if SHIM is missing — letting the loop proceed would
      // leave each binary moved to `.real` with no replacement, so the
      // next cursor-agent invocation would ENOENT. Within the loop,
      // chain mv/cp/mv with `&&` and write to `$bin.tmp` first so a
      // mid-swap cp failure can't strand us in a "real moved away,
      // shim not yet written" state — the in-place mv is atomic.
      'SHIM=/opt/cursor-agent-shim.sh; ' +
        '[ -f "$SHIM" ] || { echo "[shim] $SHIM missing, aborting"; exit 1; }; ' +
        'for bin in $HOME/.local/share/cursor-agent/versions/*/cursor-agent; do ' +
        '  [ -f "$bin" ] || continue; ' +
        '  grep -q SHIM_VERSION=cursor-cleanup-noop "$bin" 2>/dev/null && continue; ' +
        '  cp "$SHIM" "$bin.tmp" && chmod +x "$bin.tmp" && ' +
        '    mv "$bin" "$bin.real" && mv "$bin.tmp" "$bin" || ' +
        '    { echo "[shim] failed to swap $bin"; rm -f "$bin.tmp"; exit 1; }; ' +
        'done',
    ],
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
        implementReport: '',
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
    return {
      metaStatus: 'startup_failed',
      superviseReport: '',
      implementReport: '',
      elapsedMs,
    }
  }
  const meta = readMeta(runDir)
  const status: TaktMetaStatus =
    meta?.status ?? (r.code === 0 ? 'completed' : 'failed')
  return {
    metaStatus: status,
    superviseReport: status === 'completed' ? readSuperviseReport(runDir) : '',
    // Always read the implement report — classifyTakt uses it to
    // distinguish a BLOCKED abort from a generic one.
    implementReport: readImplementReport(runDir),
    elapsedMs,
    iterations: meta?.iterations,
  }
}

type DeliveryStage =
  | 'detect-branch'
  | 'detect-changes'
  | 'commit'
  | 'push'
  | 'pr-create'

type DeliveryResult =
  | { kind: 'delivered'; prUrl: string }
  | { kind: 'no_changes' }
  | { kind: 'failed'; stage: DeliveryStage; error: string }

/**
 * After a successful takt run, persist cursor's edits as a draft PR.
 * takt creates a `takt/issue-N-...` branch and lets the coder step
 * leave uncommitted edits in the working tree on the assumption that
 * "the system" will commit/push/PR after the workflow ends — this is
 * that system. Without it, every successful run leaves the work in a
 * dirty working tree that the next preflight `git reset --hard`
 * silently wipes (observed on issue #413).
 *
 * Each phase is a separate failure boundary so the post-mortem
 * comment names exactly what broke. We do not try to roll back: a
 * commit succeeded but push failed leaves the commit on the takt
 * branch, which is harmless because the next preflight resets to
 * main and the operator can either retry or push by hand.
 */
async function deliverTaktResult(
  issue: IssueRef,
  taktResult: TaktChildResult,
): Promise<DeliveryResult> {
  // `safe.directory` because git refuses to operate on a repo whose
  // owner does not match the current uid; entrypoint.sh chowns /data
  // to symphony but the global git config does not include this dir.
  const safeDir = `-c safe.directory=${REPO_DIR}`
  // Identify symphony as the committer so the audit trail names a
  // bot rather than impersonating a human GitHub account.
  const userCfg =
    '-c user.name=symphony-bot -c user.email=symphony@upflow.local'

  const branchProbe = await run('bash', [
    '-lc',
    `cd ${REPO_DIR} && git ${safeDir} branch --show-current`,
  ])
  if (branchProbe.code !== 0) {
    return {
      kind: 'failed',
      stage: 'detect-branch',
      error: runError(branchProbe),
    }
  }
  const branch = branchProbe.stdout.trim()
  if (!isValidTaktBranch(branch)) {
    return {
      kind: 'failed',
      stage: 'detect-branch',
      error: `expected takt/issue-N-* branch, got: ${branch || '(empty)'}`,
    }
  }

  const status = await run('bash', [
    '-lc',
    `cd ${REPO_DIR} && git ${safeDir} status --porcelain`,
  ])
  if (status.code !== 0) {
    return { kind: 'failed', stage: 'detect-changes', error: runError(status) }
  }
  if (status.stdout.trim() === '') {
    return { kind: 'no_changes' }
  }

  const commitMsg = formatDeliveryCommitMessage(issue.number, issue.title)
  const commit = await run(
    'bash',
    [
      '-lc',
      `cd ${REPO_DIR} && git ${safeDir} ${userCfg} add -A && git ${safeDir} ${userCfg} commit -F -`,
    ],
    { input: commitMsg },
  )
  if (commit.code !== 0) {
    return { kind: 'failed', stage: 'commit', error: runError(commit) }
  }

  const push = await run('bash', [
    '-lc',
    `cd ${REPO_DIR} && git ${safeDir} push -u origin ${branch}`,
  ])
  if (push.code !== 0) {
    return { kind: 'failed', stage: 'push', error: runError(push) }
  }

  const prBody = formatDeliveryPrBody({
    issueNumber: issue.number,
    implementReport: taktResult.implementReport,
    superviseReport: taktResult.superviseReport,
  })
  // Pass the title via env to dodge shell-quoting issues with
  // characters like ` " $ ' that show up in real issue titles.
  const pr = await run(
    'bash',
    [
      '-lc',
      `cd ${REPO_DIR} && gh pr create --draft --base main --head ${branch} --title "$ISSUE_TITLE" --body-file -`,
    ],
    { input: prBody, env: { ...process.env, ISSUE_TITLE: issue.title } },
  )
  if (pr.code !== 0) {
    return { kind: 'failed', stage: 'pr-create', error: runError(pr) }
  }

  return { kind: 'delivered', prUrl: pr.stdout.trim() }
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
        implementReport: '',
        elapsedMs: Date.now() - dayjs.utc(startedAt).valueOf(),
      }
    }

    const result = classifyTakt(taktResult)
    const finishedAt = dayjs.utc().toISOString()

    let nextLabel: string = LABEL.failed
    const extraComment: string[] = []
    if (result.outcome === 'success') {
      const delivery = await deliverTaktResult(issue, taktResult)
      match(delivery)
        .with({ kind: 'delivered' }, ({ prUrl }) => {
          nextLabel = LABEL.inReview
          extraComment.push(`- pr: ${prUrl}`)
        })
        // Workflow judged COMPLETE but cursor produced no edits —
        // either the issue was a no-op or the working tree got reset
        // mid-run. Treat as failure so it surfaces; otherwise the
        // operator would see "in-review" with no PR.
        .with({ kind: 'no_changes' }, () => {
          extraComment.push('- delivery skipped: no changes to commit')
        })
        // Wrap stderr in a fenced block so backticks / hash signs in
        // git or gh output don't break the surrounding markdown
        // comment.
        .with({ kind: 'failed' }, ({ stage, error }) => {
          extraComment.push(
            `- delivery failed at \`${stage}\`:`,
            '```',
            error.slice(0, 300),
            '```',
          )
        })
        .exhaustive()
    }

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
        ...extraComment,
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
