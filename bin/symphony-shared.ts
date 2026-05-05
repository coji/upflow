import { type ChildProcess, spawn } from 'node:child_process'

export const REPO = 'coji/upflow'
export const TAKT_WORKFLOW = 'spec-implement-accept'
export const BUDGET_MS = 90 * 60 * 1000

export const LABEL = {
  ready: 'symphony:ready',
  running: 'symphony:running',
  inReview: 'symphony:in-review',
  failed: 'symphony:failed',
} as const

export interface IssueRef {
  number: number
  title: string
  url: string
  createdAt: string
}

export interface RunResult {
  code: number
  stdout: string
  stderr: string
}

export interface RunOptions {
  input?: string
  streamPrefix?: string
  /**
   * When false, do not buffer stdout/stderr in memory. Returned strings
   * are empty. Useful for long-running children whose output is large
   * and only needed live (already streaming via streamPrefix).
   * Default true for backward compatibility.
   */
  captureOutput?: boolean
  /**
   * Invoked once with the live child handle right after spawn. Lets the
   * caller forward signals (e.g. propagate SIGTERM during shutdown) or
   * inspect the PID. Errors thrown here are swallowed so they cannot
   * abort the run.
   */
  onChild?: (child: ChildProcess) => void
}

export async function run(
  cmd: string,
  args: readonly string[],
  opts: RunOptions = {},
): Promise<RunResult> {
  const capture = opts.captureOutput !== false
  return await new Promise<RunResult>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    if (opts.onChild) {
      try {
        opts.onChild(child)
      } catch {
        // Caller-side bookkeeping shouldn't block the run.
      }
    }
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      const s = chunk.toString('utf-8')
      if (capture) stdout += s
      if (opts.streamPrefix) process.stdout.write(`${opts.streamPrefix}${s}`)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      const s = chunk.toString('utf-8')
      if (capture) stderr += s
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

export async function ghIssueList(label: string): Promise<IssueRef[]> {
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

export async function ghAddLabel(issue: number, label: string): Promise<void> {
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

export async function ghRemoveLabel(
  issue: number,
  label: string,
): Promise<void> {
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

export async function ghComment(issue: number, body: string): Promise<void> {
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
export async function usedBudgetMs(issue: number): Promise<number> {
  const comments = await ghComments(issue)
  let total = 0
  for (const c of comments) {
    const m = c.body.match(/symphony:elapsed_ms=(\d+)/)
    if (m) total += Number.parseInt(m[1], 10)
  }
  return total
}

export interface TaktOutcome {
  outcome: 'success' | 'failure_transient' | 'failure_deterministic'
  reason: string
  elapsedMs: number
}

export type TaktMetaStatus =
  | 'completed'
  | 'failed'
  | 'running'
  | 'aborted'
  | 'startup_failed'
  | 'budget_exceeded'
  | 'preflight_failed'

/**
 * Heuristic outcome classification; M0 will replace this once takt's
 * supervise step emits a structured outcome field. Today we look at the
 * takt-reported `meta.status` and the "Remaining Issues" section of the
 * supervise report.
 */
export function classifyTakt(args: {
  metaStatus: TaktMetaStatus
  superviseReport: string
  elapsedMs: number
  iterations?: number
}): TaktOutcome {
  const { metaStatus, superviseReport, elapsedMs, iterations } = args
  if (metaStatus === 'preflight_failed') {
    return {
      outcome: 'failure_transient',
      reason:
        'symphony preflight (install / db:setup / typecheck) failed before takt was invoked',
      elapsedMs,
    }
  }
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
  if (
    metaStatus === 'failed' ||
    metaStatus === 'running' ||
    metaStatus === 'aborted'
  ) {
    return {
      outcome: 'failure_transient',
      reason: `takt meta.status=${metaStatus} after polling (iterations=${iterations ?? '?'})`,
      elapsedMs,
    }
  }
  // Use takt's own structured judgment marker. The supervise-report
  // contract (`.takt/facets/output-contracts/supervise-report.md`)
  // requires `## Judgment: COMPLETE | FIX | SPEC_REVIEW`. Anything else
  // means we can't trust the report; treat as transient and let a retry
  // produce a clean one.
  const judgment = superviseReport.match(
    /^##\s*Judgment:\s*(COMPLETE|FIX|SPEC_REVIEW)\b/im,
  )?.[1]
  if (judgment === undefined) {
    return {
      outcome: 'failure_transient',
      reason: `takt meta.status=${metaStatus} but supervise report had no \`## Judgment:\` marker`,
      elapsedMs,
    }
  }
  if (judgment === 'COMPLETE') {
    return {
      outcome: 'success',
      reason: 'takt supervise judgment: COMPLETE',
      elapsedMs,
    }
  }
  // FIX / SPEC_REVIEW — capture the Remaining Issues section for context
  const remaining = superviseReport.match(
    /Remaining Issues[^\n]*\n+([\s\S]*?)(\n## |$)/i,
  )
  const tail = remaining?.[1]?.trim() ?? ''
  return {
    outcome: 'failure_deterministic',
    reason: `takt supervise judgment: ${judgment}${tail ? ` — ${tail.slice(0, 200)}` : ''}`,
    elapsedMs,
  }
}

export function elapsedMarker(elapsedMs: number): string {
  return `<!-- symphony:elapsed_ms=${elapsedMs} -->`
}

export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
