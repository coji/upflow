import { readdirSync } from 'node:fs'
import path from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'
import { describe, expect, it } from 'vitest'

// Structural test: prefer the `~/app/...` alias over deep relative imports
// that walk up two or more directories. Two-or-more `../` chains usually
// cross a sibling subtree, where the alias keeps refactors safer and the
// import readable.
//
// Source rule: CLAUDE.md:146-151, catalogued in
// docs/rdd/issue-336-rule-inventory.md (inventory row "`~/` プレフィックス").

const ROOT = path.resolve(__dirname, '../..')

const SCAN_DIRS = ['app', 'batch', 'tests']
const SOURCE_EXTS = ['.ts', '.tsx']

function isTestFile(filename: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(filename)
}

function readEntries(dir: string): ReturnType<typeof readdirSync> {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch {
    // Directory may not exist (e.g., tests/ before any tests are added).
    return []
  }
}

function collectSourceFiles(absDir: string): string[] {
  const out: string[] = []
  const stack: string[] = [absDir]
  for (let dir = stack.pop(); dir !== undefined; dir = stack.pop()) {
    for (const entry of readEntries(dir)) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      if (
        SOURCE_EXTS.some((ext) => entry.name.endsWith(ext)) &&
        !isTestFile(entry.name)
      ) {
        out.push(full)
      }
    }
  }
  return out
}

interface Violation {
  file: string
  line: number
  specifier: string
}

function findDeepRelativeImports(absFilePath: string): Violation[] {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  })
  const sf = project.addSourceFileAtPath(absFilePath)
  const violations: Violation[] = []
  const relPath = path.relative(ROOT, absFilePath)

  for (const decl of sf.getImportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue()
    if (specifier.startsWith('../../')) {
      violations.push({
        file: relPath,
        line: decl.getStartLineNumber(),
        specifier,
      })
    }
  }
  // Also check `import type { ... } from '...'` (covered above) and
  // dynamic `import('...')` if any exist in the codebase.
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getText() !== 'import') continue
    const [arg] = call.getArguments()
    if (!arg || arg.getKind() !== SyntaxKind.StringLiteral) continue
    const lit = arg.asKindOrThrow(SyntaxKind.StringLiteral)
    const value = lit.getLiteralValue()
    if (value.startsWith('../../')) {
      violations.push({
        file: relPath,
        line: call.getStartLineNumber(),
        specifier: value,
      })
    }
  }
  return violations
}

describe("Use '~/app/...' alias instead of deep relative imports", () => {
  const matchedFiles = SCAN_DIRS.flatMap((rel) =>
    collectSourceFiles(path.resolve(ROOT, rel)),
  )

  it(`scans at least one file (matched ${matchedFiles.length})`, () => {
    expect(matchedFiles.length).toBeGreaterThan(0)
  })

  it('has no `../../` (or deeper) imports', () => {
    const allViolations: Violation[] = []
    for (const abs of matchedFiles) {
      allViolations.push(...findDeepRelativeImports(abs))
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
      `import { foo } from '../../something'\nexport const x = foo`,
    )
    const found: Violation[] = []
    for (const decl of sf.getImportDeclarations()) {
      const specifier = decl.getModuleSpecifierValue()
      if (specifier.startsWith('../../')) {
        found.push({
          file: 'synthetic.ts',
          line: decl.getStartLineNumber(),
          specifier,
        })
      }
    }
    expect(found).toHaveLength(1)
  })
})
