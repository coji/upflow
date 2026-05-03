/**
 * Symphony tick — see issue #370 for design and #372 for acceptance.
 * Picks one `symphony:ready` issue, runs takt --pipeline inside the worker
 * sprite, then transitions the label and posts an attempt comment. Single
 * shot; no watch loop. Concurrency capped at 1 by the running label guard.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { spawn } from 'node:child_process'

dayjs.extend(utc)

const REPO = 'coji/upflow'
const SPRITE_NAME = 'symphony-worker'
const TAKT_WORKFLOW = 'spec-implement-accept'
const BUDGET_MS = 90 * 60 * 1000

const LABEL = {
  ready: 'symphony:ready',
  running: 'symphony:running',
  inReview: 'symphony:in-review',
  failed: 'symphony:failed',
} as const

interface IssueRef {
  number: number
  title: string
  url: string
  createdAt: string
}

async function run(
  cmd: string,
  args: readonly string[],
  opts: { input?: string; streamPrefix?: string } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      const s = chunk.toString('utf-8')
      stdout += s
      if (opts.streamPrefix) process.stdout.write(`${opts.streamPrefix}${s}`)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      const s = chunk.toString('utf-8')
      stderr += s
      if (opts.streamPrefix) process.stderr.write(`${opts.streamPrefix}${s}`)
    })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
    if (opts.input !== undefined) {
      child.stdin.end(opts.input)
    } else {
      child.stdin.end()
    }
  })
}

async function gh(args: readonly string[], input?: string): Promise<string> {
  const r = await run('gh', args, { input })
  if (r.code !== 0) {
    throw new Error(`gh ${args.join(' ')} failed (${r.code}): ${r.stderr}`)
  }
  return r.stdout
}

async function ghIssueList(label: string): Promise<IssueRef[]> {
  const json = await gh([
    'issue',
    'list',
    '--repo',
    REPO,
    '--state',
    'open',
    '--label',
    label,
    '--json',
    'number,title,url,createdAt',
    '--limit',
    '20',
  ])
  const list = JSON.parse(json) as IssueRef[]
  // Oldest first — gh issue list doesn't expose --sort; sort client-side.
  return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

async function ghAddLabel(issue: number, label: string): Promise<void> {
  await gh([
    'issue',
    'edit',
    String(issue),
    '--repo',
    REPO,
    '--add-label',
    label,
  ])
}

async function ghRemoveLabel(issue: number, label: string): Promise<void> {
  await gh([
    'issue',
    'edit',
    String(issue),
    '--repo',
    REPO,
    '--remove-label',
    label,
  ])
}

async function ghComment(issue: number, body: string): Promise<void> {
  await gh(
    ['issue', 'comment', String(issue), '--repo', REPO, '--body-file', '-'],
    body,
  )
}

async function ghComments(issue: number): Promise<{ body: string }[]> {
  const json = await gh([
    'issue',
    'view',
    String(issue),
    '--repo',
    REPO,
    '--json',
    'comments',
  ])
  const parsed = JSON.parse(json) as { comments: { body: string }[] }
  return parsed.comments
}

/**
 * Sum elapsed_ms reported by previous symphony attempt comments. Lets us
 * enforce per-issue budget across attempts without a separate state store.
 */
async function usedBudgetMs(issue: number): Promise<number> {
  const comments = await ghComments(issue)
  let total = 0
  for (const c of comments) {
    const m = c.body.match(/symphony:elapsed_ms=(\d+)/)
    if (m) total += Number.parseInt(m[1], 10)
  }
  return total
}

interface TaktOutcome {
  outcome: 'success' | 'failure_transient' | 'failure_deterministic'
  reason: string
  elapsedMs: number
}

/**
 * Heuristic outcome classification; M0 will replace this once takt's
 * supervise step emits a structured outcome field. Today we look at the
 * takt-reported `meta.status` and the "Remaining Issues" section of the
 * supervise report.
 */
function classifyTakt(args: {
  metaStatus:
    | 'completed'
    | 'failed'
    | 'running'
    | 'startup_failed'
    | 'budget_exceeded'
  superviseReport: string
  elapsedMs: number
  iterations?: number
}): TaktOutcome {
  const { metaStatus, superviseReport, elapsedMs, iterations } = args
  if (metaStatus === 'startup_failed') {
    return {
      outcome: 'failure_transient',
      reason: 'takt did not produce a run meta.json (startup failed)',
      elapsedMs,
    }
  }
  if (metaStatus === 'budget_exceeded') {
    return {
      outcome: 'failure_deterministic',
      reason: 'takt run exceeded per-issue budget without finishing',
      elapsedMs,
    }
  }
  if (metaStatus === 'failed' || metaStatus === 'running') {
    return {
      outcome: 'failure_transient',
      reason: `takt meta.status=${metaStatus} after polling (iterations=${iterations ?? '?'})`,
      elapsedMs,
    }
  }
  // completed: require an explicit "no issues" marker in the supervise
  // report. An empty / unparseable report means we cannot confirm success
  // and is classified as transient — better to retry than to silently flip
  // a bad run to in-review.
  const remaining = superviseReport.match(
    /Remaining Issues[^\n]*\n+([\s\S]*?)(\n## |$)/i,
  )
  const tail = remaining?.[1]?.trim()
  if (tail === undefined || tail === '') {
    return {
      outcome: 'failure_transient',
      reason:
        'takt meta.status=completed but the supervise report had no parseable Remaining Issues section',
      elapsedMs,
    }
  }
  if (/^なし。?$/.test(tail) || /^none\.?$/i.test(tail)) {
    return {
      outcome: 'success',
      reason: 'takt completed and supervise reports no remaining issues',
      elapsedMs,
    }
  }
  return {
    outcome: 'failure_deterministic',
    reason: `takt completed but supervise lists remaining issues: ${tail.slice(0, 200)}`,
    elapsedMs,
  }
}

/**
 * State written by takt itself into `.takt/runs/<slug>/meta.json`.
 * Polled by symphony so that we don't depend on the sprite exec exit
 * code, which is unreliable over `--http-post` on long sessions.
 */
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

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function runTaktInSprite(
  issueNumber: number,
  budgetRemainingMs: number,
): Promise<{
  superviseReport: string
  elapsedMs: number
  metaStatus: TaktMeta['status'] | 'startup_failed' | 'budget_exceeded'
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

  // First call: kick takt off and wait. Over --http-post the call may
  // either return cleanly when takt finishes, or return mid-run with a
  // best-effort exit code. Either way, we follow up with a meta.json poll.
  await spriteExec(taktCmd, { stream: true })

  // Sprite is sometimes slow to flush the just-written meta.json after
  // takt's setup step. Retry briefly before declaring startup failure.
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
      // Stop the takt run inside the sprite before reporting; otherwise the
      // process keeps consuming sprite resources until natural termination.
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
    const msg = [
      '🤖 symphony: budget exceeded, marking as failed',
      `- used: ${Math.round(used / 60000)} min / ${BUDGET_MS / 60000} min`,
      '- re-add `symphony:ready` after addressing the underlying issue to retry',
    ].join('\n')
    await ghComment(issue.number, msg)
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
      `<!-- symphony:elapsed_ms=${result.elapsedMs} -->`,
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
