/**
 * Symphony runner — long-lived loop that runs *inside* the worker sprite as
 * a Service. Polls GitHub for `symphony:ready` issues, spawns takt as a
 * direct child process, and transitions labels + posts attempt comments.
 *
 * This avoids the `sprite exec` long-connection failure mode (issue #378)
 * because takt is now a local child process, not behind an HTTP exec.
 *
 * Concurrency is naturally 1 because the loop awaits one takt run at a
 * time. On startup we reconcile any orphaned `symphony:running` issue
 * from a prior crash by transitioning it to `failed` with a transient
 * reason.
 *
 * See issue #370 for the overall design and #379 (D2) for this iteration.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  BUDGET_MS,
  type IssueRef,
  LABEL,
  TAKT_WORKFLOW,
  type TaktMetaStatus,
  classifyTakt,
  elapsedMarker,
  ghAddLabel,
  ghComment,
  ghIssueList,
  ghRemoveLabel,
  run,
  sleep,
  usedBudgetMs,
} from './symphony-shared'

dayjs.extend(utc)

const POLL_INTERVAL_MS = 60_000
const REPO_DIR = process.env.SYMPHONY_REPO_DIR ?? join(homedir(), 'upflow')

interface TaktChildResult {
  metaStatus: TaktMetaStatus
  superviseReport: string
  elapsedMs: number
  iterations?: number
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

async function runTakt(issueNumber: number): Promise<TaktChildResult> {
  const startMs = Date.now()
  const cmd = [
    'cd',
    REPO_DIR,
    '&&',
    'git fetch --quiet',
    '&&',
    'git checkout main',
    '&&',
    'git pull --ff-only --quiet',
    '&&',
    'pnpm install --frozen-lockfile --silent',
    '&&',
    'takt',
    '--pipeline',
    '-i',
    String(issueNumber),
    '-w',
    TAKT_WORKFLOW,
  ].join(' ')

  // Stream stdout/stderr to the Service's log so it shows up in
  // `sprite api .../services/symphony-runner/logs`.
  const r = await run('bash', ['-lc', cmd], { streamPrefix: '[takt] ' })
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

async function processIssue(issue: IssueRef): Promise<void> {
  console.log(`[pick] #${issue.number} ${issue.title}`)
  const startedAt = dayjs.utc().toISOString()
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
    return
  }

  await ghRemoveLabel(issue.number, LABEL.ready)
  await ghAddLabel(issue.number, LABEL.running)
  await ghComment(
    issue.number,
    [
      `🤖 symphony attempt starting at ${startedAt}`,
      `- workflow: ${TAKT_WORKFLOW}`,
      `- runner: in-sprite Service`,
      `- budget remaining: ${Math.round(remainingMs / 60000)} min`,
    ].join('\n'),
  )

  let taktResult: TaktChildResult
  try {
    taktResult = await runTakt(issue.number)
  } catch (e) {
    taktResult = {
      metaStatus: 'failed',
      superviseReport: '',
      elapsedMs: Date.now() - dayjs(startedAt).valueOf(),
    }
    console.error(
      '[error] takt subprocess threw:',
      e instanceof Error ? e.message : e,
    )
  }

  const result = classifyTakt(taktResult)
  const finishedAt = dayjs.utc().toISOString()
  const nextLabel = result.outcome === 'success' ? LABEL.inReview : LABEL.failed
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
}

/**
 * On Service startup, an issue can be left with `symphony:running` because
 * the previous Service process died (sprite hibernation, restart, crash).
 * Reconcile by transitioning to failed with a transient reason; the human
 * can re-label `ready` to retry. Without this we'd never pick a new issue
 * because the running guard would block forever.
 */
async function reconcileOrphans(): Promise<void> {
  const orphans = await ghIssueList(LABEL.running)
  for (const issue of orphans) {
    console.log(`[orphan] #${issue.number} was left running, marking failed`)
    await ghComment(
      issue.number,
      [
        '🤖 symphony: previous attempt did not complete (Service restart or crash)',
        '- transitioning to failed (transient reason)',
        '- re-add `symphony:ready` to retry',
      ].join('\n'),
    )
    await ghRemoveLabel(issue.number, LABEL.running)
    await ghAddLabel(issue.number, LABEL.failed)
  }
}

let stopRequested = false

async function loop(): Promise<void> {
  console.log(`[boot] symphony-runner starting at ${dayjs.utc().toISOString()}`)
  console.log(`[boot] repo dir: ${REPO_DIR}`)
  console.log(`[boot] poll interval: ${POLL_INTERVAL_MS / 1000}s`)
  console.log(`[boot] budget per issue: ${BUDGET_MS / 60000} min`)

  await reconcileOrphans()

  while (!stopRequested) {
    try {
      const ready = await ghIssueList(LABEL.ready)
      if (ready.length > 0) {
        await processIssue(ready[0])
      }
    } catch (e) {
      console.error(
        '[error] loop iteration failed:',
        e instanceof Error ? e.message : e,
      )
    }
    if (stopRequested) break
    await sleep(POLL_INTERVAL_MS)
  }
  console.log('[shutdown] loop exited')
}

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    console.log(`[signal] received ${sig}, requesting shutdown`)
    stopRequested = true
  })
}

loop().catch((err) => {
  console.error('[fatal]', err instanceof Error ? err.message : err)
  process.exit(1)
})
