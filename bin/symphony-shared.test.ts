import { describe, expect, it } from 'vitest'
import { classifyTakt, run } from './symphony-shared'

const baseArgs = { elapsedMs: 1000 }

describe('classifyTakt', () => {
  describe('preflight_failed', () => {
    it('reports the failing stage when preflightFailedAt is provided', () => {
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'preflight_failed',
        superviseReport: '',
        preflightFailedAt: 'pnpm typecheck',
      })
      expect(r.outcome).toBe('failure_transient')
      expect(r.reason).toBe('symphony preflight failed at: pnpm typecheck')
    })

    it('falls back to a generic reason without preflightFailedAt', () => {
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'preflight_failed',
        superviseReport: '',
      })
      expect(r.outcome).toBe('failure_transient')
      expect(r.reason).toBe('symphony preflight failed before takt was invoked')
    })
  })

  it('returns failure_transient on startup_failed', () => {
    const r = classifyTakt({
      ...baseArgs,
      metaStatus: 'startup_failed',
      superviseReport: '',
    })
    expect(r.outcome).toBe('failure_transient')
    expect(r.reason).toContain('startup failed')
  })

  it('returns failure_deterministic on budget_exceeded', () => {
    const r = classifyTakt({
      ...baseArgs,
      metaStatus: 'budget_exceeded',
      superviseReport: '',
    })
    expect(r.outcome).toBe('failure_deterministic')
    expect(r.reason).toContain('budget')
  })

  for (const status of ['failed', 'running', 'aborted'] as const) {
    it(`returns failure_transient on ${status} and includes the status in reason`, () => {
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: status,
        superviseReport: '',
        iterations: 3,
      })
      expect(r.outcome).toBe('failure_transient')
      expect(r.reason).toContain(`meta.status=${status}`)
      expect(r.reason).toContain('iterations=3')
    })
  }

  describe('completed', () => {
    it('returns success on Judgment: COMPLETE', () => {
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'completed',
        superviseReport: '## Judgment: COMPLETE\n\nLooks good.',
      })
      expect(r.outcome).toBe('success')
      expect(r.reason).toBe('takt supervise judgment: COMPLETE')
    })

    it('returns failure_deterministic on Judgment: FIX with Remaining Issues', () => {
      const report = [
        '## Judgment: FIX',
        '',
        '## Remaining Issues',
        '',
        '- typecheck still fails on app/foo.ts',
      ].join('\n')
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'completed',
        superviseReport: report,
      })
      expect(r.outcome).toBe('failure_deterministic')
      expect(r.reason).toContain('FIX')
      expect(r.reason).toContain('typecheck still fails')
    })

    it('returns failure_deterministic on Judgment: SPEC_REVIEW', () => {
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'completed',
        superviseReport: '## Judgment: SPEC_REVIEW\n',
      })
      expect(r.outcome).toBe('failure_deterministic')
      expect(r.reason).toContain('SPEC_REVIEW')
    })

    it('returns failure_transient when Judgment marker is missing and includes the actual metaStatus', () => {
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'completed',
        superviseReport: 'Random freeform text without the marker.',
      })
      expect(r.outcome).toBe('failure_transient')
      expect(r.reason).toContain('meta.status=completed')
      expect(r.reason).toContain('no `## Judgment:` marker')
    })
  })
})

describe('run() onStdoutLine', () => {
  it('emits each newline-terminated stdout line exactly once', async () => {
    const lines: string[] = []
    const r = await run('bash', ['-lc', 'printf "alpha\\nbeta\\ngamma\\n"'], {
      captureOutput: false,
      onStdoutLine: (line) => lines.push(line),
    })
    expect(r.code).toBe(0)
    expect(lines).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('flushes a trailing partial line on close', async () => {
    const lines: string[] = []
    const r = await run('bash', ['-lc', 'printf "first\\nno-newline-tail"'], {
      captureOutput: false,
      onStdoutLine: (line) => lines.push(line),
    })
    expect(r.code).toBe(0)
    expect(lines).toEqual(['first', 'no-newline-tail'])
  })

  it('handles a single chunk that contains multiple lines', async () => {
    const lines: string[] = []
    const r = await run('bash', ['-lc', 'printf "one\\ntwo\\nthree\\n"'], {
      captureOutput: false,
      onStdoutLine: (line) => lines.push(line),
    })
    expect(r.code).toBe(0)
    expect(lines).toEqual(['one', 'two', 'three'])
  })

  it('does not break when onStdoutLine throws', async () => {
    const calls: string[] = []
    const r = await run('bash', ['-lc', 'printf "a\\nb\\nc\\n"'], {
      captureOutput: false,
      onStdoutLine: (line) => {
        calls.push(line)
        throw new Error('boom')
      },
    })
    expect(r.code).toBe(0)
    expect(calls).toEqual(['a', 'b', 'c'])
  })
})
