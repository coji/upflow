/**
 * Symphony tick (local) — single-shot orchestrator that runs *outside* the
 * sprite. Picks one `symphony:ready` issue, runs takt over `sprite exec
 * --http-post`, then transitions labels. Useful for local debugging or
 * one-off manual ticks; the always-on production path is the in-sprite
 * Service in `bin/symphony-runner.ts`. See issue #370 for design.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import {
  BUDGET_MS,
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
  run,
  sleep,
  usedBudgetMs,
} from './symphony-shared'

dayjs.extend(utc)

const SPRITE_NAME = 'symphony-worker'

interface TaktMeta {
  runSlug: string
  status: 'running' | 'completed' | 'failed'
  startTime: string
  updatedAt: string
  endTime?: string
  iterations?: number
  currentStep?: string
}

async function spriteExec(
  cmd: string,
  opts: { stream?: boolean } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  // `--http-post` survives the long-running case where the WebSocket would
  // otherwise drop after ~15-17 min; the trade-off is that the exit code is
  // best-effort, so callers must use other signals (meta.json, file
  // existence) to determine real outcome. See issue #378.
  return await run(
    'sprite',
    ['exec', '-s', SPRITE_NAME, '--http-post', '--', 'bash', '-lc', cmd],
    opts.stream ? { streamPrefix: '[sprite] ' } : {},
  )
}

async function readLatestRunMeta(
  newerThanIso: string,
): Promise<TaktMeta | null> {
  const r = await spriteExec(
    `cd ~/upflow && find .takt/runs -maxdepth 2 -name meta.json -newermt '${newerThanIso}' -printf '%T@ %p\\n' 2>/dev/null | sort -nr | head -1 | awk '{print $2}' | xargs -r cat 2>/dev/null`,
  )
  const out = r.stdout.trim()
  if (!out) return null
  try {
    return JSON.parse(out) as TaktMeta
  } catch {
    return null
  }
}

async function readSuperviseReport(runSlug: string): Promise<string> {
  const r = await spriteExec(
    `cat ~/upflow/.takt/runs/${runSlug}/reports/supervise-report.md 2>/dev/null || true`,
  )
  return r.stdout
}

async function stopTaktInSprite(issueNumber: number): Promise<void> {
  // Best-effort: takt --pipeline launches with the issue number in argv,
  // so pkill -f matches the active process. Ignore exit codes — pkill
  // returns 1 if no match, which is fine when the process already died.
  try {
    await spriteExec(
      `pkill -TERM -f 'takt --pipeline -i ${issueNumber}' 2>/dev/null; sleep 5; pkill -KILL -f 'takt --pipeline -i ${issueNumber}' 2>/dev/null; true`,
    )
  } catch (e) {
    console.warn('[stop] pkill failed:', e instanceof Error ? e.message : e)
  }
}

async function runTaktInSprite(
  issueNumber: number,
  budgetRemainingMs: number,
): Promise<{
  superviseReport: string
  elapsedMs: number
  metaStatus: TaktMetaStatus
  iterations?: number
}> {
  const startMs = Date.now()
  const startIso = dayjs.utc().subtract(5, 'second').toISOString()

  const taktCmd = [
    'cd ~/upflow',
    'git fetch --quiet',
    'git checkout main',
    'git pull --ff-only --quiet',
    'pnpm install --frozen-lockfile --silent',
    `takt --pipeline -i ${issueNumber} -w ${TAKT_WORKFLOW}`,
  ].join(' && ')

  await spriteExec(taktCmd, { stream: true })

  let meta = await readLatestRunMeta(startIso)
  for (let i = 0; i < 5 && meta === null; i++) {
    await sleep(5_000)
    meta = await readLatestRunMeta(startIso)
  }
  if (meta === null) {
    return {
      superviseReport: '',
      elapsedMs: Date.now() - startMs,
      metaStatus: 'startup_failed',
    }
  }

  const POLL_INTERVAL_MS = 30_000
  while (meta.status === 'running') {
    if (Date.now() - startMs >= budgetRemainingMs) {
      await stopTaktInSprite(issueNumber)
      const final = await readLatestRunMeta(startIso)
      return {
        superviseReport: '',
        elapsedMs: Date.now() - startMs,
        metaStatus: 'budget_exceeded',
        iterations: final?.iterations ?? meta.iterations,
      }
    }
    console.log(
      `[poll] takt still running (step=${meta.currentStep ?? '?'} iter=${meta.iterations ?? '?'})`,
    )
    await sleep(POLL_INTERVAL_MS)
    const next = await readLatestRunMeta(startIso)
    if (next !== null) meta = next
  }

  const superviseReport =
    meta.status === 'completed' ? await readSuperviseReport(meta.runSlug) : ''

  return {
    superviseReport,
    elapsedMs: Date.now() - startMs,
    metaStatus: meta.status,
    iterations: meta.iterations,
  }
}

async function tick(): Promise<void> {
  const startedAt = dayjs.utc().toISOString()
  console.log(`[tick] started at ${startedAt}`)

  const running = await ghIssueList(LABEL.running)
  if (running.length > 0) {
    console.log(
      `[skip] concurrency=1 — issue #${running[0].number} is already running`,
    )
    return
  }

  const ready = await ghIssueList(LABEL.ready)
  if (ready.length === 0) {
    console.log('[idle] no ready issues')
    return
  }
  const issue = ready[0]
  console.log(`[pick] #${issue.number} ${issue.title}`)

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
      `- sprite: ${SPRITE_NAME}`,
      `- budget remaining: ${Math.round(remainingMs / 60000)} min`,
    ].join('\n'),
  )

  let result: TaktOutcome
  try {
    const taktResult = await runTaktInSprite(issue.number, remainingMs)
    result = classifyTakt(taktResult)
  } catch (e) {
    result = {
      outcome: 'failure_transient',
      reason: e instanceof Error ? e.message : String(e),
      elapsedMs: Date.now() - dayjs(startedAt).valueOf(),
    }
  }

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

const sub = process.argv[2]
if (sub !== 'tick') {
  console.error('usage: symphony tick')
  process.exit(1)
}
tick().catch((err) => {
  console.error('[fatal]', err instanceof Error ? err.message : err)
  process.exit(1)
})
