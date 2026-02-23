/**
 * 005 - LLM分類ベースのオートマージシミュレーション
 *
 * 003(ルールベース)と同じシミュレーションを、LLM分類で再実行。
 * 全PRをGemini Flash Liteで分類し、XS/Sの自動マージ効果を比較する。
 *
 * LLM分類結果はキャッシュされ、2回目以降はAPI呼び出しなしで実行可能。
 *
 * Usage:
 *   pnpm tsx lab/experiments/005-llm-automerge-simulation.ts
 *   pnpm tsx lab/experiments/005-llm-automerge-simulation.ts --refresh  # キャッシュ無視
 *
 * 環境変数:
 *   GEMINI_API_KEY — Google AI Studio APIキー (初回のみ必須)
 */

import consola from 'consola'
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { type PRSize, classifyPR } from '../lib/classify'
import type { PRSizeInfo } from '../lib/github'
import {
  type LLMClassification,
  type ReviewComplexity,
  batchClassifyWithLLM,
  estimateCost,
} from '../lib/llm-classify'

const DATA_DIR = path.join(import.meta.dirname, '..', 'data')
const OUTPUT_DIR = path.join(import.meta.dirname, '..', 'output')
const CACHE_FILE = path.join(DATA_DIR, 'llm-classifications-cache.json')

const args = process.argv.slice(2)
const refresh = args.includes('--refresh')

interface QueueEvent {
  time: string
  reviewer: string
  type: 'add' | 'remove'
  pr: { repo: string; number: number }
}

type SizeLabel = ReviewComplexity

function simulateQueue(
  events: QueueEvent[],
  prSizeMap: Record<string, SizeLabel>,
  autoMergeSizes: Set<SizeLabel>,
) {
  const queues: Record<string, Set<string>> = {}
  const snapshots: { day: string; total: number }[] = []
  let lastDay: string | null = null

  for (const e of events) {
    const key = `${e.pr.repo}#${e.pr.number}`
    const size = prSizeMap[key] || 'M'
    const reviewer = e.reviewer

    if (autoMergeSizes.has(size)) continue

    if (!queues[reviewer]) queues[reviewer] = new Set()
    if (e.type === 'add') {
      queues[reviewer].add(key)
    } else {
      queues[reviewer].delete(key)
    }

    const day = e.time.slice(0, 10)
    if (day !== lastDay) {
      let total = 0
      for (const r in queues) total += queues[r].size
      snapshots.push({ day, total })
      lastDay = day
    }
  }

  return snapshots
}

function avgQueue(snapshots: { total: number }[]): number {
  if (snapshots.length === 0) return 0
  return snapshots.reduce((s, d) => s + d.total, 0) / snapshots.length
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function percentile(arr: number[], p: number): number | null {
  if (arr.length === 0) return null
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * p)]
}

async function main() {
  // Load data
  const sizesFile = path.join(DATA_DIR, 'pr-sizes.json')
  const eventsFile = path.join(OUTPUT_DIR, 'review-queue-events.json')

  if (!fs.existsSync(sizesFile)) {
    consola.error(`Data not found: ${sizesFile}`)
    consola.info('Run: pnpm tsx lab/fetch.ts --only sizes')
    process.exit(1)
  }
  if (!fs.existsSync(eventsFile)) {
    consola.error(`Events not found: ${eventsFile}`)
    consola.info('Run: pnpm tsx lab/experiments/001-queue-visualization.ts')
    process.exit(1)
  }

  const allPRs: PRSizeInfo[] = JSON.parse(fs.readFileSync(sizesFile, 'utf-8'))
  const mergedPRs = allPRs.filter(
    (pr) => pr.mergedAt && pr.createdAt >= '2025-01-01',
  )
  const reviewEvents: QueueEvent[] = JSON.parse(
    fs.readFileSync(eventsFile, 'utf-8'),
  )

  consola.info(`Merged PRs (2025+): ${mergedPRs.length}`)

  // LLM classification (with cache)
  let llmMap: Record<string, LLMClassification>

  if (!refresh && fs.existsSync(CACHE_FILE)) {
    consola.info(`Using LLM classification cache: ${CACHE_FILE}`)
    llmMap = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    const cached = Object.keys(llmMap).length
    const missing = mergedPRs.filter((pr) => !llmMap[`${pr.repo}#${pr.number}`])
    consola.info(`  Cached: ${cached}, Missing: ${missing.length}`)

    if (missing.length > 0) {
      consola.start(`Classifying ${missing.length} uncached PRs...`)
      const result = await batchClassifyWithLLM(missing, {
        concurrency: 10,
        delayMs: 100,
        onProgress: (done, total, usage) => {
          const cost = estimateCost(usage)
          consola.info(`  ${done}/${total} ($${cost.toFixed(4)})`)
        },
      })
      for (const [key, cls] of result.classifications) {
        llmMap[key] = cls
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(llmMap, null, 2))
      consola.success(
        `Updated cache (${result.classifications.size} new, $${result.estimatedCost.toFixed(4)})`,
      )
    }
  } else {
    consola.start(`Classifying all ${mergedPRs.length} PRs with LLM...`)
    const result = await batchClassifyWithLLM(mergedPRs, {
      concurrency: 10,
      delayMs: 100,
      onProgress: (done, total, usage) => {
        const cost = estimateCost(usage)
        consola.info(`  ${done}/${total} ($${cost.toFixed(4)})`)
      },
    })

    llmMap = Object.fromEntries(result.classifications)
    fs.writeFileSync(CACHE_FILE, JSON.stringify(llmMap, null, 2))
    consola.success(
      `Classified ${mergedPRs.length} PRs ($${result.estimatedCost.toFixed(4)})`,
    )
    consola.info(
      `  Tokens: ${result.totalUsage.promptTokens.toLocaleString()} prompt + ${result.totalUsage.candidatesTokens.toLocaleString()} output`,
    )
  }

  // Build size maps
  const ruleSizeMap: Record<string, PRSize> = {}
  const llmSizeMap: Record<string, SizeLabel> = {}
  for (const pr of mergedPRs) {
    const key = `${pr.repo}#${pr.number}`
    ruleSizeMap[key] = classifyPR(pr)
    llmSizeMap[key] = llmMap[key]?.complexity ?? 'M'
  }

  // Size distribution comparison
  const ruleCounts: Record<string, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0 }
  const llmCounts: Record<string, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0 }
  for (const pr of mergedPRs) {
    const key = `${pr.repo}#${pr.number}`
    ruleCounts[ruleSizeMap[key]]++
    llmCounts[llmSizeMap[key]]++
  }

  consola.info('\n=== Size Distribution Comparison ===')
  consola.info(
    `${'Size'.padEnd(5)} ${'Rule'.padStart(6)} ${'LLM'.padStart(6)} ${'Diff'.padStart(6)}`,
  )
  for (const size of ['XS', 'S', 'M', 'L', 'XL']) {
    const diff = llmCounts[size] - ruleCounts[size]
    const sign = diff > 0 ? '+' : ''
    consola.info(
      `${size.padEnd(5)} ${String(ruleCounts[size]).padStart(6)} ${String(llmCounts[size]).padStart(6)} ${(sign + diff).padStart(6)}`,
    )
  }

  // Simulate with both
  const scenarios = [
    { label: 'Baseline', sizes: new Set<SizeLabel>() },
    { label: 'Auto XS', sizes: new Set<SizeLabel>(['XS']) },
    { label: 'Auto XS+S', sizes: new Set<SizeLabel>(['XS', 'S']) },
  ]

  consola.info('\n=== Auto Merge Simulation ===')
  consola.info(
    `${'Scenario'.padEnd(12)} ${'Rule avg'.padStart(10)} ${'LLM avg'.padStart(10)} ${'Rule %'.padStart(8)} ${'LLM %'.padStart(8)}`,
  )

  const ruleBaseline = avgQueue(
    simulateQueue(reviewEvents, ruleSizeMap, new Set()),
  )
  const llmBaseline = avgQueue(
    simulateQueue(reviewEvents, llmSizeMap, new Set()),
  )

  const simResults: Record<
    string,
    {
      rule: number
      llm: number
      ruleReduction: number
      llmReduction: number
      ruleSnapshots: { day: string; total: number }[]
      llmSnapshots: { day: string; total: number }[]
    }
  > = {}

  for (const { label, sizes } of scenarios) {
    const ruleSnapshots = simulateQueue(reviewEvents, ruleSizeMap, sizes)
    const llmSnapshots = simulateQueue(reviewEvents, llmSizeMap, sizes)
    const ruleAvg = avgQueue(ruleSnapshots)
    const llmAvg = avgQueue(llmSnapshots)
    const ruleReduction =
      sizes.size > 0 ? (1 - ruleAvg / ruleBaseline) * 100 : 0
    const llmReduction = sizes.size > 0 ? (1 - llmAvg / llmBaseline) * 100 : 0

    simResults[label] = {
      rule: ruleAvg,
      llm: llmAvg,
      ruleReduction,
      llmReduction,
      ruleSnapshots,
      llmSnapshots,
    }

    consola.info(
      `${label.padEnd(12)} ${ruleAvg.toFixed(1).padStart(10)} ${llmAvg.toFixed(1).padStart(10)} ${(sizes.size > 0 ? `-${ruleReduction.toFixed(1)}%` : '-').padStart(8)} ${(sizes.size > 0 ? `-${llmReduction.toFixed(1)}%` : '-').padStart(8)}`,
    )
  }

  // Pickup time by LLM size
  const pickupBySize: Record<SizeLabel, number[]> = {
    XS: [],
    S: [],
    M: [],
    L: [],
    XL: [],
  }
  for (const pr of mergedPRs) {
    const key = `${pr.repo}#${pr.number}`
    const size = llmSizeMap[key]
    const addEvent = reviewEvents.find(
      (e) => e.type === 'add' && `${e.pr.repo}#${e.pr.number}` === key,
    )
    const removeEvent = reviewEvents.find(
      (e) => e.type === 'remove' && `${e.pr.repo}#${e.pr.number}` === key,
    )
    if (addEvent && removeEvent) {
      const hours =
        (new Date(removeEvent.time).getTime() -
          new Date(addEvent.time).getTime()) /
        3600000
      if (hours > 0 && hours < 720) {
        pickupBySize[size].push(hours)
      }
    }
  }

  consola.info('\n=== Review Wait Time by LLM Size ===')
  for (const size of ['XS', 'S', 'M', 'L', 'XL'] as SizeLabel[]) {
    const times = pickupBySize[size]
    if (times.length === 0) continue
    consola.info(
      `  ${size.padEnd(3)} n=${String(times.length).padStart(3)}  median=${median(times)?.toFixed(1)}h  p75=${percentile(times, 0.75)?.toFixed(1)}h  p90=${percentile(times, 0.9)?.toFixed(1)}h`,
    )
  }

  // Save
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const outputFile = path.join(OUTPUT_DIR, 'llm-automerge-simulation-data.json')
  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      {
        meta: {
          totalPRs: mergedPRs.length,
          timestamp: new Date().toISOString(),
        },
        sizeDistribution: { rule: ruleCounts, llm: llmCounts },
        simulation: simResults,
        pickupBySize: Object.fromEntries(
          Object.entries(pickupBySize).map(([size, times]) => [
            size,
            {
              count: times.length,
              median: median(times),
              p75: percentile(times, 0.75),
              p90: percentile(times, 0.9),
            },
          ]),
        ),
        classifications: mergedPRs.map((pr) => {
          const key = `${pr.repo}#${pr.number}`
          return {
            owner: pr.owner,
            repo: pr.repo,
            number: pr.number,
            title: pr.title,
            author: pr.author?.login,
            ruleSize: ruleSizeMap[key],
            llmSize: llmSizeMap[key],
            llmReason: llmMap[key]?.reason,
            llmRiskAreas: llmMap[key]?.risk_areas,
          }
        }),
      },
      null,
      2,
    ),
  )
  consola.success(`Output: ${outputFile}`)
}

main().catch((err) => {
  consola.error(err)
  process.exit(1)
})
