import { type Dirent, readdirSync } from 'node:fs'
import path from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'
import { describe, expect, it } from 'vitest'

// Structural test: in batch/, do not call `.format(...)` to convert datetime
// values. GitHub API returns ISO 8601 strings; save them to the DB as-is.
// The only place a custom format is allowed is the dedicated helper at
// `batch/helper/timeformat.ts`, which is for report / spreadsheet output.
//
// Source rule: CLAUDE.md:137, catalogued in
// docs/rdd/issue-336-rule-inventory.md (inventory row "batch では GitHub API
// の ISO 8601 をそのまま DB に保存し、独自フォーマット変換をかけない").

const ROOT = path.resolve(__dirname, '../..')

const SCAN_ROOT = 'batch'
const SOURCE_EXTS = ['.ts', '.tsx']

// Files where `.format(...)` is the documented intended behavior. Keep this
// list as small as possible; every entry is an exception that must be
// justified in CLAUDE.md or a relevant RDD.
const EXEMPT_FILES = new Set<string>(['batch/helper/timeformat.ts'])

function isTestFile(filename: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(filename)
}

function readEntries(dir: string): Dirent<string>[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch {
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
  text: string
}

function findFormatCalls(absFilePath: string): Violation[] {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  })
  const sf = project.addSourceFileAtPath(absFilePath)
  const violations: Violation[] = []
  const relPath = path.relative(ROOT, absFilePath)

  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return
    const call = node.asKindOrThrow(SyntaxKind.CallExpression)
    const expr = call.getExpression()
    if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return
    const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression)
    if (propAccess.getName() !== 'format') return

    violations.push({
      file: relPath,
      line: call.getStartLineNumber(),
      text: call.getText().slice(0, 80),
    })
  })

  return violations
}

describe('No `.format(...)` outside batch/helper/timeformat.ts', () => {
  const matchedFiles = collectSourceFiles(path.resolve(ROOT, SCAN_ROOT)).filter(
    (p) => !EXEMPT_FILES.has(path.relative(ROOT, p)),
  )

  it(`scans at least one file (matched ${matchedFiles.length})`, () => {
    expect(matchedFiles.length).toBeGreaterThan(0)
  })

  it('has no `.format(...)` calls outside the timeformat helper', () => {
    const allViolations: Violation[] = []
    for (const abs of matchedFiles) {
      allViolations.push(...findFormatCalls(abs))
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
        import dayjs from 'dayjs'
        export function bad(value: string) {
          return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
        }
      `,
    )
    const found: Violation[] = []
    sf.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return
      const call = node.asKindOrThrow(SyntaxKind.CallExpression)
      const expr = call.getExpression()
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return
      const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression)
      if (propAccess.getName() !== 'format') return
      found.push({
        file: 'synthetic.ts',
        line: call.getStartLineNumber(),
        text: call.getText(),
      })
    })
    expect(found).toHaveLength(1)
  })
})
