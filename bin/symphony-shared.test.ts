import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { classifyTakt, readLatestJsonlEvent, run } from './symphony-shared'

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
