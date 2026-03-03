/**
 * サンプル抽出スクリプト
 *
 * DB の分類済み PR から層化ランダムサンプリングでサンプルを抽出する。
 * judge.ts の入力となる samples/*.json を生成。
 *
 * Usage:
 *   pnpm tsx lab/classify/sample.ts
 *   pnpm tsx lab/classify/sample.ts --per-label 100
 *   pnpm tsx lab/classify/sample.ts --seed 42
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import type { PRRecord } from './judge-common'
import { SAMPLES_DIR } from './judge-common'

const DB_PATH = path.join('data', 'tenant_iris.db')
const LEVELS = ['XS', 'S', 'M', 'L', 'XL'] as const

interface PRRow {
  number: number
  repository_id: string
  title: string
  author: string | null
  additions: number | null
  deletions: number | null
  changed_files: number | null
  complexity: string
  complexity_reason: string | null
  raw_pull_request: string | null
}

/** Seeded pseudo-random (mulberry32) */
function createRng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function extractRawData(rawJson: string | null): {
  body: string | null
  source_branch: string | null
  target_branch: string | null
  files: { path: string; additions: number; deletions: number }[]
} {
  if (!rawJson) {
    return { body: null, source_branch: null, target_branch: null, files: [] }
  }
  try {
    const raw = JSON.parse(rawJson)
    const files = (raw.files ?? []) as {
      path: string
      additions: number
      deletions: number
    }[]
    return {
      body: raw.body ?? null,
      source_branch: raw.sourceBranch ?? null,
      target_branch: raw.targetBranch ?? null,
      files: files.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
      })),
    }
  } catch {
    return { body: null, source_branch: null, target_branch: null, files: [] }
  }
}

function main() {
  const args = process.argv.slice(2)
  let perLabel = 50
  let seed = Date.now()

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--per-label' && args[i + 1]) {
      perLabel = Number.parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--seed' && args[i + 1]) {
      seed = Number.parseInt(args[i + 1], 10)
      i++
    }
  }

  const db = new Database(DB_PATH, { readonly: true })
  const rng = createRng(seed)

  console.log(`Seed: ${seed}`)
  console.log(`Per-label target: ${perLabel}`)

  const allRows = db
    .prepare(
      `SELECT p.number, p.repository_id, p.title, p.author, p.additions, p.deletions,
              p.changed_files, p.complexity, p.complexity_reason,
              g.pull_request AS raw_pull_request
       FROM pull_requests p
       LEFT JOIN github_raw_data g
         ON g.repository_id = p.repository_id AND g.pull_request_number = p.number
       WHERE p.complexity IS NOT NULL`,
    )
    .all() as PRRow[]

  console.log(`Total classified PRs: ${allRows.length}`)

  // Group by label
  const byLabel = new Map<string, PRRow[]>()
  for (const row of allRows) {
    const group = byLabel.get(row.complexity) ?? []
    group.push(row)
    byLabel.set(row.complexity, group)
  }

  fs.mkdirSync(SAMPLES_DIR, { recursive: true })

  const allSampled: PRRow[] = []

  for (const level of LEVELS) {
    const group = byLabel.get(level) ?? []
    const n = Math.min(perLabel, group.length)
    const sampled = shuffle(group, rng).slice(0, n)
    allSampled.push(...sampled)

    console.log(`  ${level}: ${n}/${group.length} sampled`)
  }

  // Write single combined file
  const records: PRRecord[] = allSampled.map((row) => {
    const rawData = extractRawData(row.raw_pull_request)
    return {
      number: row.number,
      repository_id: row.repository_id,
      title: row.title,
      author: row.author,
      additions: row.additions,
      deletions: row.deletions,
      changed_files: row.changed_files,
      current_label: row.complexity,
      complexity_reason: row.complexity_reason ?? '',
      body: rawData.body,
      source_branch: rawData.source_branch,
      target_branch: rawData.target_branch,
      files: rawData.files,
    }
  })

  const outPath = path.join(SAMPLES_DIR, 'stratified.json')
  fs.writeFileSync(outPath, JSON.stringify(records, null, 2))
  console.log(`\nWrote ${records.length} PRs to ${outPath}`)

  db.close()
}

main()
