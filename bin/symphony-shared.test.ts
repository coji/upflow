import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifyTakt,
  formatDeliveryCommitMessage,
  formatDeliveryPrBody,
  isValidTaktBranch,
  parseFiniteNumberEnv,
  readLatestJsonlEvent,
  run,
} from './symphony-shared'

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

  describe('aborted with implement report', () => {
    it('returns failure_deterministic with the Why when implement is BLOCKED', () => {
      const report = [
        '# Implementation Result',
        '',
        '## Implement: BLOCKED',
        '',
        '## Why',
        '',
        'order.md does not specify the API endpoint shape and the',
        'caller does not exist in the repo yet.',
      ].join('\n')
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'aborted',
        superviseReport: '',
        implementReport: report,
      })
      expect(r.outcome).toBe('failure_deterministic')
      expect(r.reason).toContain('takt implement judgment: BLOCKED')
      expect(r.reason).toContain('does not specify the API endpoint')
    })

    it('still returns failure_deterministic when BLOCKED has no Why section', () => {
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'aborted',
        superviseReport: '',
        implementReport: '## Implement: BLOCKED\n',
      })
      expect(r.outcome).toBe('failure_deterministic')
      expect(r.reason).toBe('takt implement judgment: BLOCKED')
    })

    it('falls back to transient when implement marker says COMPLETED but workflow aborted elsewhere', () => {
      // e.g. fix step succeeded but supervise ABORTed for spec-level
      // reasons; the COMPLETED marker is stale and shouldn't fake a
      // human-needed signal.
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'aborted',
        superviseReport: '',
        implementReport: '## Implement: COMPLETED\n',
        iterations: 2,
      })
      expect(r.outcome).toBe('failure_transient')
      expect(r.reason).toContain('meta.status=aborted')
    })

    it('falls back to transient when implement report has no marker', () => {
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'aborted',
        superviseReport: '',
        implementReport: 'random text without marker',
        iterations: 1,
      })
      expect(r.outcome).toBe('failure_transient')
      expect(r.reason).toContain('meta.status=aborted')
    })

    it('truncates very long Why text to keep the post-mortem comment readable', () => {
      const why = 'x'.repeat(500)
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'aborted',
        superviseReport: '',
        implementReport: `## Implement: BLOCKED\n\n## Why\n\n${why}`,
      })
      expect(r.outcome).toBe('failure_deterministic')
      // 200-char cap matches the supervise FIX path
      expect(r.reason.length).toBeLessThan(300)
    })

    it('captures the entire multi-line Why body, not just the first line', () => {
      // Regression: the previous single-regex `/^##\s*Why...$/im`
      // implementation matched `$` at the first line boundary and
      // silently dropped subsequent lines. The post-mortem comment
      // would only show the first sentence of the blocker.
      const report = [
        '## Implement: BLOCKED',
        '',
        '## Why',
        '',
        'First line of the blocker.',
        'Second line continues here.',
        'Third line still part of the same paragraph.',
      ].join('\n')
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'aborted',
        superviseReport: '',
        implementReport: report,
      })
      expect(r.outcome).toBe('failure_deterministic')
      expect(r.reason).toContain('First line of the blocker.')
      expect(r.reason).toContain('Second line continues here.')
      expect(r.reason).toContain('Third line still part of the same paragraph.')
    })

    it('handles the literal `## Why (if BLOCKED)` heading from the contract template', () => {
      const report = [
        '## Implement: BLOCKED',
        '',
        '## Why (if BLOCKED)',
        '',
        'Cannot proceed without the API key.',
      ].join('\n')
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'aborted',
        superviseReport: '',
        implementReport: report,
      })
      expect(r.outcome).toBe('failure_deterministic')
      expect(r.reason).toContain('Cannot proceed without the API key.')
    })

    it('stops Why extraction at the next `##` heading', () => {
      const report = [
        '## Implement: BLOCKED',
        '',
        '## Why',
        '',
        'The actual blocker description.',
        '',
        '## Notes',
        '',
        'Unrelated extra context that should not appear in the reason.',
      ].join('\n')
      const r = classifyTakt({
        ...baseArgs,
        metaStatus: 'aborted',
        superviseReport: '',
        implementReport: report,
      })
      expect(r.reason).toContain('The actual blocker description.')
      expect(r.reason).not.toContain('Unrelated extra context')
    })
  })

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

describe('readLatestJsonlEvent', () => {
  let runDir: string

  beforeEach(() => {
    runDir = mkdtempSync(join(tmpdir(), 'symphony-jsonl-'))
    mkdirSync(join(runDir, 'logs'), { recursive: true })
  })
  afterEach(() => {
    rmSync(runDir, { recursive: true, force: true })
  })

  function writeJsonl(name: string, lines: string[]): void {
    writeFileSync(join(runDir, 'logs', name), `${lines.join('\n')}\n`)
  }

  it('returns null when the logs directory is missing', () => {
    rmSync(join(runDir, 'logs'), { recursive: true })
    expect(readLatestJsonlEvent(runDir)).toBeNull()
  })

  it('returns null when no jsonl files exist', () => {
    expect(readLatestJsonlEvent(runDir)).toBeNull()
  })

  it('returns null on an empty jsonl file', () => {
    writeFileSync(join(runDir, 'logs', 'empty.jsonl'), '')
    expect(readLatestJsonlEvent(runDir)).toBeNull()
  })

  it('parses the last line of a small jsonl file', () => {
    writeJsonl('a.jsonl', [
      JSON.stringify({
        type: 'workflow_start',
        timestamp: '2026-05-05T00:00:00Z',
      }),
      JSON.stringify({ type: 'step_start', timestamp: '2026-05-05T00:00:10Z' }),
      JSON.stringify({
        type: 'step_complete',
        timestamp: '2026-05-05T00:00:20Z',
      }),
    ])
    expect(readLatestJsonlEvent(runDir)).toEqual({
      type: 'step_complete',
      timestamp: '2026-05-05T00:00:20Z',
    })
  })

  it('falls back to endTime when timestamp is absent', () => {
    writeJsonl('a.jsonl', [
      JSON.stringify({
        type: 'workflow_abort',
        endTime: '2026-05-05T01:00:00Z',
      }),
    ])
    expect(readLatestJsonlEvent(runDir)).toEqual({
      type: 'workflow_abort',
      timestamp: '2026-05-05T01:00:00Z',
    })
  })

  it('handles a giant first line followed by a small last line (>4 KB tail safety)', () => {
    // workflow_start often embeds the full issue body; this used to break a
    // 4 KB tail when the LAST event was small enough to fit but the file
    // overall didn't. With the 64 KB tail it works as long as the LAST
    // event itself is < 64 KB.
    const huge = JSON.stringify({
      type: 'workflow_start',
      task: 'x'.repeat(20_000),
    })
    writeJsonl('a.jsonl', [
      huge,
      JSON.stringify({
        type: 'step_complete',
        timestamp: '2026-05-05T02:00:00Z',
      }),
    ])
    expect(readLatestJsonlEvent(runDir)).toEqual({
      type: 'step_complete',
      timestamp: '2026-05-05T02:00:00Z',
    })
  })

  it('returns null when the last line is malformed JSON (does not throw)', () => {
    writeFileSync(
      join(runDir, 'logs', 'a.jsonl'),
      `${JSON.stringify({ type: 'ok' })}\nnot-json\n`,
    )
    expect(readLatestJsonlEvent(runDir)).toBeNull()
  })

  it('picks the most recently modified jsonl when multiple exist', () => {
    writeJsonl('older.jsonl', [
      JSON.stringify({ type: 'older', timestamp: '2026-05-05T00:00:00Z' }),
    ])
    // Force older mtime well into the past so the sort is unambiguous.
    const olderPath = join(runDir, 'logs', 'older.jsonl')
    const past = (Date.now() - 60_000) / 1000
    utimesSync(olderPath, past, past)
    writeJsonl('newer.jsonl', [
      JSON.stringify({ type: 'newer', timestamp: '2026-05-05T00:01:00Z' }),
    ])
    expect(readLatestJsonlEvent(runDir)).toEqual({
      type: 'newer',
      timestamp: '2026-05-05T00:01:00Z',
    })
  })
})

describe('parseFiniteNumberEnv', () => {
  const KEY = '__SYMPHONY_TEST_NUMBER_ENV__'

  beforeEach(() => {
    delete process.env[KEY]
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    delete process.env[KEY]
    vi.restoreAllMocks()
  })

  it('returns the fallback when the env var is unset (no warning)', () => {
    expect(parseFiniteNumberEnv(KEY, { fallback: 42 })).toBe(42)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('parses a valid numeric string', () => {
    process.env[KEY] = '1500'
    expect(parseFiniteNumberEnv(KEY, { fallback: 30000, min: 1000 })).toBe(1500)
  })

  it('falls back and warns on a non-numeric value (NaN guard)', () => {
    process.env[KEY] = 'abc'
    expect(parseFiniteNumberEnv(KEY, { fallback: 30000, min: 1000 })).toBe(
      30000,
    )
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('falls back and warns on a value below `min` (busy-loop guard)', () => {
    process.env[KEY] = '0'
    expect(parseFiniteNumberEnv(KEY, { fallback: 30000, min: 1000 })).toBe(
      30000,
    )
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('falls back and warns on a value above `max`', () => {
    process.env[KEY] = '99999'
    expect(
      parseFiniteNumberEnv(KEY, { fallback: 8080, min: 1, max: 65535 }),
    ).toBe(8080)
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('falls back and warns on Infinity', () => {
    process.env[KEY] = 'Infinity'
    expect(parseFiniteNumberEnv(KEY, { fallback: 42 })).toBe(42)
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('accepts the boundary values inclusively', () => {
    process.env[KEY] = '1000'
    expect(parseFiniteNumberEnv(KEY, { fallback: 30000, min: 1000 })).toBe(1000)
    expect(console.warn).not.toHaveBeenCalled()
  })
})

describe('isValidTaktBranch', () => {
  it.each([
    ['takt/issue-413-1778258246', true],
    ['takt/issue-1-0', true],
    ['takt/issue-413-anything-after', true],
    ['main', false],
    ['takt/foo', false],
    ['takt/issue-/something', false],
    ['takt/issue-abc-123', false],
    ['feat/takt/issue-413-x', false],
    ['', false],
  ])('isValidTaktBranch(%s) === %s', (branch, expected) => {
    expect(isValidTaktBranch(branch)).toBe(expected)
  })
})

describe('formatDeliveryCommitMessage', () => {
  it('puts the issue title on the first line and includes Closes #N', () => {
    const m = formatDeliveryCommitMessage(413, 'Brand: UpFlow → Upflow')
    expect(m.split('\n')[0]).toBe('Brand: UpFlow → Upflow')
    expect(m).toContain('Closes #413')
    expect(m).toContain('Generated by symphony pipeline for issue #413')
  })

  it('survives titles with quotes and shell metachars unchanged (commit -F handles literal)', () => {
    const tricky = `It's "hard" to $ESCAPE shell \`safely\``
    const m = formatDeliveryCommitMessage(1, tricky)
    expect(m.split('\n')[0]).toBe(tricky)
  })
})

describe('formatDeliveryPrBody', () => {
  const implementReport = [
    '# Implementation Result',
    '',
    '## Implement: COMPLETED',
    '',
    '## Summary',
    '',
    'Renamed product brand from UpFlow to Upflow across 4 files.',
    '',
    '## Files Changed',
    '',
    '- README.md',
  ].join('\n')

  const superviseReport = [
    '# Final Verification Result',
    '',
    '## Judgment: COMPLETE',
    '',
    '## Summary',
    '',
    'All completion criteria met. Diff is in scope.',
    '',
    '## Validation',
    '',
    'pnpm validate passed.',
  ].join('\n')

  it('extracts implement Summary and supervise Summary into the body', () => {
    const body = formatDeliveryPrBody({
      issueNumber: 413,
      implementReport,
      superviseReport,
    })
    expect(body).toContain(
      'Renamed product brand from UpFlow to Upflow across 4 files.',
    )
    expect(body).toContain('All completion criteria met. Diff is in scope.')
    expect(body).toContain('Closes #413')
    expect(body).toContain('🤖 Generated by Symphony pipeline for issue #413')
  })

  it('falls back to a placeholder when a Summary section is missing', () => {
    const body = formatDeliveryPrBody({
      issueNumber: 1,
      implementReport: '## Implement: COMPLETED\n\nNo summary section here.',
      superviseReport: '',
    })
    expect(body).toContain('(no Summary section in implement-report.md)')
    expect(body).toContain('(no Summary section in supervise-report.md)')
  })

  it('captures multi-line Summary bodies, not just the first line', () => {
    const multilineImplement = [
      '## Summary',
      '',
      'First line of summary.',
      'Second line continues.',
      'Third line still in summary.',
      '',
      '## Files Changed',
      '',
      '- foo.ts',
    ].join('\n')
    const body = formatDeliveryPrBody({
      issueNumber: 1,
      implementReport: multilineImplement,
      superviseReport: '## Summary\n\nLooks good.',
    })
    expect(body).toContain('First line of summary.')
    expect(body).toContain('Second line continues.')
    expect(body).toContain('Third line still in summary.')
    // Stops at the next ## heading (Files Changed should not bleed in)
    expect(body).not.toContain('foo.ts')
  })
})
