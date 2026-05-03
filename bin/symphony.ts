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
  exitCode: number
  elapsedMs: number
}

/**
 * Heuristic outcome classification; M0 will replace this once takt's
 * supervise step emits a structured outcome field. Today we just look at
 * the takt exit code and a couple of strings in the supervise report.
 */
function classifyTakt(
  exitCode: number,
  superviseReport: string,
  elapsedMs: number,
): TaktOutcome {
  if (exitCode === 0) {
    const remaining = superviseReport.match(
      /Remaining Issues[^\n]*\n+([\s\S]*?)(\n## |$)/i,
    )
    const tail = remaining?.[1]?.trim() ?? ''
    if (tail === '' || /^なし。?$/.test(tail) || /^none\.?$/i.test(tail)) {
      return {
        outcome: 'success',
        reason: 'takt exited 0 and supervise reports no remaining issues',
        exitCode,
        elapsedMs,
      }
    }
    return {
      outcome: 'failure_deterministic',
      reason: `takt exited 0 but supervise lists remaining issues: ${tail.slice(0, 200)}`,
      exitCode,
      elapsedMs,
    }
  }
  return {
    outcome: 'failure_transient',
    reason: `takt exited with code ${exitCode}`,
    exitCode,
    elapsedMs,
  }
}

async function runTaktInSprite(issueNumber: number): Promise<{
  exitCode: number
  superviseReport: string
  elapsedMs: number
}> {
  const start = Date.now()
  const taktCmd = [
    'cd ~/upflow',
    'git fetch --quiet',
    'git checkout main',
    'git pull --ff-only --quiet',
    'pnpm install --frozen-lockfile --silent',
    `takt --pipeline -i ${issueNumber} -w ${TAKT_WORKFLOW}`,
  ].join(' && ')
  const r = await run(
    'sprite',
    ['exec', '-s', SPRITE_NAME, '--', 'bash', '-lc', taktCmd],
    { streamPrefix: '[sprite] ' },
  )
  const elapsedMs = Date.now() - start

  const reportPath =
    'find .takt/runs -name supervise-report.md -newer ~/upflow/.git/HEAD | head -1'
  const reportR = await run(
    'sprite',
    [
      'exec',
      '-s',
      SPRITE_NAME,
      '--',
      'bash',
      '-lc',
      `cd ~/upflow && cat $(${reportPath}) 2>/dev/null || true`,
    ],
    {},
  )
  return {
    exitCode: r.code,
    superviseReport: reportR.stdout,
    elapsedMs,
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
    const taktResult = await runTaktInSprite(issue.number)
    result = classifyTakt(
      taktResult.exitCode,
      taktResult.superviseReport,
      taktResult.elapsedMs,
    )
  } catch (e) {
    result = {
      outcome: 'failure_transient',
      reason: e instanceof Error ? e.message : String(e),
      exitCode: -1,
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
