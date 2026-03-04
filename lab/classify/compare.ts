/**
 * Eval 比較スクリプト
 *
 * 2つの eval JSON を読んで差分を表示する。API 呼び出しなし。
 *
 * Usage:
 *   pnpm tsx lab/classify/compare.ts data/evals/eval_A.json data/evals/eval_B.json
 */
import fs from 'node:fs'
import path from 'node:path'

interface PerClass {
  label: string
  precision: number
  recall: number
  f1: number
  count: number
}

interface EvalResult {
  timestamp: string
  model: string
  promptHash?: string
  metrics: {
    accuracy: number
    avgDrift: number
    perClass: PerClass[]
  }
  disagreements: {
    key: string
    title: string
    golden: string
    predicted: string
  }[]
  totalEvaluated: number
}

function loadEval(filePath: string): EvalResult {
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf-8'))
}

function delta(a: number, b: number, pct = false): string {
  const d = b - a
  const sign = d > 0 ? '+' : ''
  if (pct) return `${sign}${(d * 100).toFixed(1)}pp`
  return `${sign}${d.toFixed(2)}`
}

function main() {
  const [fileA, fileB] = process.argv.slice(2)
  if (!fileA || !fileB) {
    console.error('Usage: compare.ts <eval_A.json> <eval_B.json>')
    process.exit(1)
  }

  const a = loadEval(fileA)
  const b = loadEval(fileB)

  console.log('=== Eval Comparison ===\n')
  console.log(
    `  A: ${path.basename(fileA)} (${a.model}, hash=${a.promptHash ?? '?'}, n=${a.totalEvaluated})`,
  )
  console.log(
    `  B: ${path.basename(fileB)} (${b.model}, hash=${b.promptHash ?? '?'}, n=${b.totalEvaluated})`,
  )

  console.log('\n--- Summary ---')
  console.log(
    `  Accuracy:  ${(a.metrics.accuracy * 100).toFixed(1)}% → ${(b.metrics.accuracy * 100).toFixed(1)}%  (${delta(a.metrics.accuracy, b.metrics.accuracy, true)})`,
  )
  console.log(
    `  Avg drift: ${a.metrics.avgDrift.toFixed(2)} → ${b.metrics.avgDrift.toFixed(2)}  (${delta(a.metrics.avgDrift, b.metrics.avgDrift)})`,
  )

  // Per-class F1 delta
  console.log('\n--- Per-class F1 ---')
  console.log(
    `${'Label'.padEnd(6)} ${'A'.padStart(7)} ${'B'.padStart(7)} ${'Delta'.padStart(8)}`,
  )
  const aByLabel = new Map(a.metrics.perClass.map((c) => [c.label, c]))
  const bByLabel = new Map(b.metrics.perClass.map((c) => [c.label, c]))
  for (const label of ['XS', 'S', 'M', 'L', 'XL']) {
    const af1 = aByLabel.get(label)?.f1 ?? 0
    const bf1 = bByLabel.get(label)?.f1 ?? 0
    const d = bf1 - af1
    const arrow = d > 0.01 ? ' ↑' : d < -0.01 ? ' ↓' : ''
    console.log(
      `${label.padEnd(6)} ${(af1 * 100).toFixed(1).padStart(6)}% ${(bf1 * 100).toFixed(1).padStart(6)}% ${delta(af1, bf1, true).padStart(8)}${arrow}`,
    )
  }

  // Disagreement diff
  const aDisagreeKeys = new Set(a.disagreements.map((d) => d.key))
  const bDisagreeKeys = new Set(b.disagreements.map((d) => d.key))

  const improved = a.disagreements.filter((d) => !bDisagreeKeys.has(d.key))
  const regressed = b.disagreements.filter((d) => !aDisagreeKeys.has(d.key))

  if (improved.length > 0) {
    console.log(`\n--- Improved (${improved.length} PRs now correct) ---`)
    for (const d of improved.slice(0, 15)) {
      console.log(
        `  ✓ ${d.key} | ${d.golden} (was predicted ${d.predicted}) | ${d.title}`,
      )
    }
    if (improved.length > 15)
      console.log(`  ... and ${improved.length - 15} more`)
  }

  if (regressed.length > 0) {
    console.log(`\n--- Regressed (${regressed.length} PRs now wrong) ---`)
    for (const d of regressed.slice(0, 15)) {
      console.log(`  ✗ ${d.key} | ${d.golden} → ${d.predicted} | ${d.title}`)
    }
    if (regressed.length > 15)
      console.log(`  ... and ${regressed.length - 15} more`)
  }

  if (improved.length === 0 && regressed.length === 0) {
    console.log('\n  No per-PR changes in disagreements.')
  }
}

main()
