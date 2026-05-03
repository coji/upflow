import { type Dirent, readdirSync } from 'node:fs'
import path from 'node:path'
import { Project, type SourceFile, SyntaxKind } from 'ts-morph'
import { describe, expect, it } from 'vitest'

// Structural test: inside a kysely `sql` tagged template literal, identifiers
// in the literal SQL text are NOT converted by CamelCasePlugin. So referring
// to a column directly as `tableName.columnName` in the raw SQL keeps the
// camelCase form, which doesn't match the snake_case column on disk.
//
// Rule: use `sql.ref('tableName.columnName')` in an interpolation
// (`${sql.ref(...)}`) for any column reference. Bare `table.column` patterns
// in the literal text portion of `sql\`...\`` are forbidden when either the
// table or column has camelCase form (i.e. the case-conversion failure is
// observable).
//
// Source rule: CLAUDE.md "CamelCasePlugin と `sql` テンプレート",
// catalogued in docs/rdd/issue-336-rule-inventory.md (Medium #7).

const ROOT = path.resolve(__dirname, '../..')

const SCAN_ROOTS = ['app', 'batch']
const SOURCE_EXTS = ['.ts', '.tsx']

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
  ref: string
}

// True if `s` looks like camelCase (a lowercase letter immediately followed by
// an uppercase letter). `users` → false, `createdAt` → true, `id` → false.
function hasCamelCase(s: string): boolean {
  return /[a-z][A-Z]/.test(s)
}

function detectCamelCaseDottedRefs(text: string): string[] {
  const out: string[] = []
  // `\b<word>.<word>\b` — word characters split by a single dot.
  const dotRefRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*\b/g
  for (const m of text.matchAll(dotRefRegex)) {
    const ref = m[0]
    const dotIndex = ref.indexOf('.')
    const left = ref.slice(0, dotIndex)
    const right = ref.slice(dotIndex + 1)
    if (hasCamelCase(left) || hasCamelCase(right)) {
      out.push(ref)
    }
  }
  return out
}

// Treat the tag as kysely's `sql` if its leading identifier is `sql`. This
// matches both `sql\`...\`` and `sql<SqlBool>\`...\``.
function tagIsSql(tagText: string): boolean {
  const leading = tagText.split('<')[0].trim()
  return leading === 'sql'
}

function findViolationsInSourceFile(
  sf: SourceFile,
  relPath: string,
): Violation[] {
  const violations: Violation[] = []

  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.TaggedTemplateExpression) return
    const tagged = node.asKindOrThrow(SyntaxKind.TaggedTemplateExpression)
    if (!tagIsSql(tagged.getTag().getText())) return

    const template = tagged.getTemplate()

    // Collect literal text portions only (skip ${...} interpolations).
    const portions: { text: string; line: number }[] = []
    if (template.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
      const lit = template.asKindOrThrow(
        SyntaxKind.NoSubstitutionTemplateLiteral,
      )
      portions.push({
        text: lit.getLiteralText(),
        line: lit.getStartLineNumber(),
      })
    } else if (template.getKind() === SyntaxKind.TemplateExpression) {
      const expr = template.asKindOrThrow(SyntaxKind.TemplateExpression)
      const head = expr.getHead()
      portions.push({
        text: head.getLiteralText(),
        line: head.getStartLineNumber(),
      })
      for (const span of expr.getTemplateSpans()) {
        const lit = span.getLiteral()
        portions.push({
          text: lit.getLiteralText(),
          line: lit.getStartLineNumber(),
        })
      }
    }

    for (const { text, line } of portions) {
      for (const ref of detectCamelCaseDottedRefs(text)) {
        violations.push({ file: relPath, line, ref })
      }
    }
  })

  return violations
}

describe('No camelCase `table.column` in `sql` template literal text', () => {
  const matchedFiles = SCAN_ROOTS.flatMap((dir) =>
    collectSourceFiles(path.resolve(ROOT, dir)),
  )

  it(`scans at least one file (matched ${matchedFiles.length})`, () => {
    expect(matchedFiles.length).toBeGreaterThan(0)
  })

  it('has no camelCase dotted refs in `sql` template text portions', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    })

    const allViolations: Violation[] = []
    for (const abs of matchedFiles) {
      const sf = project.addSourceFileAtPath(abs)
      allViolations.push(
        ...findViolationsInSourceFile(sf, path.relative(ROOT, abs)),
      )
      project.removeSourceFile(sf)
    }
    expect(allViolations).toEqual([])
  })

  it('catches a synthetic violation (camelCase column in template text)', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    })
    const sf = project.createSourceFile(
      'synthetic.ts',
      `
        import { sql } from 'kysely'
        export function bad() {
          return sql\`SELECT users.createdAt FROM users\`
        }
      `,
    )
    const violations = findViolationsInSourceFile(sf, 'synthetic.ts')
    expect(violations).toHaveLength(1)
    expect(violations[0].ref).toBe('users.createdAt')
  })

  it('does not flag `sql.ref(...)` interpolations', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    })
    const sf = project.createSourceFile(
      'synthetic.ts',
      `
        import { sql } from 'kysely'
        export function ok() {
          return sql\`\${sql.ref('users.createdAt')} IS NOT NULL\`
        }
      `,
    )
    expect(findViolationsInSourceFile(sf, 'synthetic.ts')).toEqual([])
  })

  it('does not flag snake_case or all-lowercase dotted refs', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    })
    const sf = project.createSourceFile(
      'synthetic.ts',
      `
        import { sql } from 'kysely'
        export function ok() {
          return sql\`SELECT users.id, t.name FROM users JOIN t ON users.id = t.user_id\`
        }
      `,
    )
    expect(findViolationsInSourceFile(sf, 'synthetic.ts')).toEqual([])
  })

  it('handles `sql<SqlBool>` typed tags', () => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    })
    const sf = project.createSourceFile(
      'synthetic.ts',
      `
        import { sql, type SqlBool } from 'kysely'
        export function bad() {
          return sql<SqlBool>\`companyGithubUsers.displayName IS NULL\`
        }
      `,
    )
    const violations = findViolationsInSourceFile(sf, 'synthetic.ts')
    expect(violations).toHaveLength(1)
    expect(violations[0].ref).toBe('companyGithubUsers.displayName')
  })
})
