import { globSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(__dirname, '../..')
const NEEDLE = 'ENABLE_E2E_LOGIN'

/**
 * Paths that may reference ENABLE_E2E_LOGIN (task spec + allowlisted docs).
 * Every other scanned file must not mention it.
 */
const ALLOWED_PATHS = new Set([
  'app/routes/_auth/test-login.ts',
  'package.json',
  'tests/structural/test-login-guard.test.ts',
  'docs/rdd/issue-363-e2e-login-foundation.md',
  'docs/rdd/README.md',
  'README.md',
  'CLAUDE.md',
])

const SCAN_GLOBS = ['**/*.{ts,tsx,js,mjs,cjs,json,yml,yaml,md}'] as const

const IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/build/**',
  '**/coverage/**',
  '**/dist/**',
  '**/data/**',
  '**/opensrc/**',
  '**/.cache/**',
  '**/playwright-report/**',
  '**/test-results/**',
  '**/lab/**',
  '**/z/**',
]

function normalizeRel(p: string): string {
  return p.split(path.sep).join('/')
}

// Computed once at module load — both `it` blocks below share the result.
const SCANNED_FILES: string[] = globSync(SCAN_GLOBS, {
  cwd: REPO_ROOT,
  exclude: IGNORE_GLOBS,
}).map(normalizeRel)

function findOffenders(
  files: readonly string[],
  allowlist: ReadonlySet<string>,
): string[] {
  const bad: string[] = []
  for (const rel of files) {
    if (allowlist.has(rel)) continue
    let text: string
    try {
      text = readFileSync(path.join(REPO_ROOT, rel), 'utf8')
    } catch {
      continue
    }
    if (text.includes(NEEDLE)) bad.push(rel)
  }
  return bad.sort()
}

describe('e2e test-login guard (structural)', () => {
  it('scans at least one file', () => {
    expect(SCANNED_FILES.length).toBeGreaterThan(50)
  })

  it('does not leak ENABLE_E2E_LOGIN outside the allowlist', () => {
    const bad = findOffenders(SCANNED_FILES, ALLOWED_PATHS)
    expect(bad, `Unexpected ENABLE_E2E_LOGIN in:\n${bad.join('\n')}`).toEqual(
      [],
    )
  })

  it('synthetic: matcher flags non-allowlisted files containing the needle', () => {
    // Sanity check that findOffenders actually catches violations — guards
    // against the matcher silently turning into a no-op.
    const synthetic = findOffenders(
      [
        'tests/structural/test-login-guard.test.ts', // allowlisted (this file)
        'app/routes/_auth/test-login.ts', // allowlisted
        'README.md', // allowlisted
      ],
      // Empty allowlist → every needle-bearing file should be reported.
      new Set(),
    )
    expect(synthetic).toContain('tests/structural/test-login-guard.test.ts')
    expect(synthetic).toContain('app/routes/_auth/test-login.ts')
  })

  it('test-login.ts contains the NODE_ENV !== production guard', () => {
    const src = readFileSync(
      path.join(REPO_ROOT, 'app/routes/_auth/test-login.ts'),
      'utf8',
    )
    // Tolerate quote style and whitespace variation around the comparison.
    expect(src).toMatch(/NODE_ENV\s*!==?\s*['"]production['"]/)
  })

  it('Dockerfile does not set ENABLE_E2E_LOGIN', () => {
    const dockerfile = readFileSync(path.join(REPO_ROOT, 'Dockerfile'), 'utf8')
    expect(dockerfile.includes(NEEDLE)).toBe(false)
  })

  it('deploy workflow does not set ENABLE_E2E_LOGIN', () => {
    const deploy = readFileSync(
      path.join(REPO_ROOT, '.github/workflows/deploy.yml'),
      'utf8',
    )
    expect(deploy.includes(NEEDLE)).toBe(false)
  })
})
