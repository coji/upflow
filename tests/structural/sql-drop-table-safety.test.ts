import { type Dirent, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Structural test: hand-written `DROP TABLE` statements in migrations must
// include `IF EXISTS`. Atlas-generated table-rebuild blocks emit `DROP TABLE`
// without `IF EXISTS` but only after a successful
// `INSERT INTO `new_X` ... SELECT ... FROM `X`` for the same table — those
// are safe to leave alone per CLAUDE.md:127.
//
// Source rule: CLAUDE.md:127 + .takt/facets/policies/step-implementation.md
// (DG-MIGRATION-ATLAS), catalogued in docs/rdd/issue-336-rule-inventory.md.

const ROOT = path.resolve(__dirname, '../..')
const MIGRATIONS_ROOT = path.resolve(ROOT, 'db/migrations')

function readEntries(dir: string): Dirent<string>[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

function collectSqlFiles(absDir: string): string[] {
  const out: string[] = []
  const stack: string[] = [absDir]
  for (let dir = stack.pop(); dir !== undefined; dir = stack.pop()) {
    for (const entry of readEntries(dir)) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      if (entry.name.endsWith('.sql')) {
        out.push(full)
      }
    }
  }
  return out
}

interface Violation {
  file: string
  line: number
  table: string
}

// Match `DROP TABLE \`X\``; capture the table name. Skips the `IF EXISTS`
// variant. Backticked or unquoted identifiers, case-insensitive on the
// keywords. The leading line-or-start anchor avoids matching `DROP TABLE`
// inside string literals starting mid-line.
const DROP_TABLE_REGEX =
  /(^|\n)\s*DROP\s+TABLE\s+(?!IF\s+EXISTS\s+)`?([A-Za-z_][A-Za-z0-9_]*)`?\s*;/gi

function detectUnsafeDropsInText(text: string, filePath: string): Violation[] {
  const violations: Violation[] = []

  for (const match of text.matchAll(DROP_TABLE_REGEX)) {
    const table = match[2]
    const matchIndex = match.index ?? 0
    const before = text.slice(0, matchIndex)
    // The regex captures a leading `\n` as part of the match (group 1), but
    // `before` stops just before that `\n`. Include it when present so the
    // reported line number points to the line where DROP TABLE actually sits.
    const beforeWithCapturedNewline =
      text[matchIndex] === '\n' ? `${before}\n` : before
    const line = beforeWithCapturedNewline.split('\n').length

    // Atlas-style table rebuild: an INSERT INTO `new_<table>` ... FROM `<table>`
    // before this DROP TABLE in the same file. The Atlas pattern always uses
    // `new_<original>` as the staging table, so checking for that and the
    // `FROM \`<table>\`` clause is enough to recognize the safe context.
    const rebuildPattern = new RegExp(
      `INSERT\\s+INTO\\s+\`new_${table}\`[\\s\\S]*?FROM\\s+\`${table}\``,
      'i',
    )
    if (rebuildPattern.test(before)) continue

    violations.push({ file: filePath, line, table })
  }

  return violations
}

function findUnsafeDropTables(absFilePath: string): Violation[] {
  const text = readFileSync(absFilePath, 'utf8')
  return detectUnsafeDropsInText(text, path.relative(ROOT, absFilePath))
}

describe('Manual DROP TABLE statements must include IF EXISTS', () => {
  const files = collectSqlFiles(MIGRATIONS_ROOT)

  it(`scans at least one migration file (matched ${files.length})`, () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('has no unsafe `DROP TABLE` statements', () => {
    const allViolations: Violation[] = []
    for (const abs of files) {
      allViolations.push(...findUnsafeDropTables(abs))
    }
    expect(allViolations).toEqual([])
  })

  it('catches a synthetic violation (manual DROP without IF EXISTS)', () => {
    const text = ['-- some manual cleanup', 'DROP TABLE `legacy_users`;'].join(
      '\n',
    )
    const violations = detectUnsafeDropsInText(text, 'synthetic.sql')
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({
      file: 'synthetic.sql',
      line: 2,
      table: 'legacy_users',
    })
  })

  it('does not flag the Atlas-style rebuild pattern', () => {
    const text = [
      'CREATE TABLE `new_users` (...);',
      'INSERT INTO `new_users` (id) SELECT id FROM `users`;',
      'DROP TABLE `users`;',
      'ALTER TABLE `new_users` RENAME TO `users`;',
    ].join('\n')
    expect(detectUnsafeDropsInText(text, 'synthetic.sql')).toEqual([])
  })
})
