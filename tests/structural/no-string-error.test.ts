import { globSync } from 'node:fs'
import path from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'
import { describe, expect, it } from 'vitest'

// Structural test: forbid `String(e)` / `String(err)` / `String(error)` etc.
// for error message extraction. Use `getErrorMessage` (UI) or
// `getErrorMessageForLog` (server log) from `~/app/libs/error-message`.
//
// Source rule: CLAUDE.md line 219, catalogued in
// docs/rdd/issue-336-rule-inventory.md (DG-FACET-OVERLAP / inventory row 38).
//
// Why: `String(err)` produces "[object Error]" for Error instances, hiding
// the actual message. The helpers do `instanceof Error ? .message : ...`
// at one place.

const ROOT = path.resolve(__dirname, '../..')

// Files where the helper is intentionally referenced in prose (comments,
// fixtures). Skipping them prevents the test from flagging documentation.
const EXEMPT_FILES = new Set<string>(['app/libs/error-message.ts'])

// Identifiers conventionally used for caught error values.
const ERROR_VAR_NAMES = new Set(['e', 'err', 'error', 'exception', 'exc'])

const SCAN_GLOBS = ['app/**/*.{ts,tsx}', 'batch/**/*.ts']
const IGNORE_GLOBS = [
  '**/*.test.{ts,tsx}',
  '**/*.spec.{ts,tsx}',
  '**/__tests__/**',
  '**/node_modules/**',
]

interface Violation {
  file: string
  line: number
  text: string
}

// Shared Project across the scan: ts-morph caches each parsed source
// file inside the Project, so reusing the same instance avoids paying
// the ~5MB+ initialization cost per file. Without this the scan blows
// past the 5s default vitest timeout once the scanned tree grows.
const sharedProject = new Project({
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
})

function findStringErrorViolations(absFilePath: string): Violation[] {
  const sf = sharedProject.addSourceFileAtPath(absFilePath)
  const violations: Violation[] = []
  const relPath = path.relative(ROOT, absFilePath)

  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return
    const call = node.asKindOrThrow(SyntaxKind.CallExpression)
    if (call.getExpression().getText() !== 'String') return

    const [arg] = call.getArguments()
    if (!arg || arg.getKind() !== SyntaxKind.Identifier) return
    const name = arg.getText()
    if (!ERROR_VAR_NAMES.has(name)) return

    violations.push({
      file: relPath,
      line: call.getStartLineNumber(),
      text: call.getText(),
    })
  })

  return violations
}

describe('No String(error) — use getErrorMessage[ForLog]', () => {
  const matchedFiles = globSync(SCAN_GLOBS, {
    cwd: ROOT,
    exclude: IGNORE_GLOBS,
  })
    .map((rel) => path.resolve(ROOT, rel))
    .filter((p) => !EXEMPT_FILES.has(path.relative(ROOT, p)))

  it(`scans at least one file (matched ${matchedFiles.length})`, () => {
    expect(matchedFiles.length).toBeGreaterThan(0)
  })

  // 30s timeout: standalone this test runs in <1s thanks to the shared
  // Project (introduced in PR #377), but under the full vitest worker load
  // ts-morph's initial source-file ingestion can blow past the 5s default.
  it('has no String(error-name) violations', { timeout: 30_000 }, () => {
    const allViolations: Violation[] = []
    for (const abs of matchedFiles) {
      allViolations.push(...findStringErrorViolations(abs))
    }
    expect(allViolations).toEqual([])
  })

  it('catches a synthetic violation (sanity check on the matcher)', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    })
    const sf = project.createSourceFile(
      'synthetic.ts',
      `
        function f() {
          try {
            doStuff()
          } catch (err) {
            console.log(String(err))
          }
        }
      `,
    )
    const found: Violation[] = []
    sf.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return
      const call = node.asKindOrThrow(SyntaxKind.CallExpression)
      if (call.getExpression().getText() !== 'String') return
      const [arg] = call.getArguments()
      if (!arg || arg.getKind() !== SyntaxKind.Identifier) return
      const name = arg.getText()
      if (!ERROR_VAR_NAMES.has(name)) return
      found.push({ file: 'synthetic.ts', line: 0, text: call.getText() })
    })
    expect(found).toHaveLength(1)
  })
})
