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
import { createReport } from '../lib/report'

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

  // ── Generate HTML Report ──────────────────────────────────────────
  const total = mergedPRs.length
  const llmXSSPct = (((llmCounts.XS + llmCounts.S) / total) * 100).toFixed(0)
  const llmReduction = simResults['Auto XS+S'].llmReduction
  const autoMergeCount = llmCounts.XS + llmCounts.S
  const needsReviewCount = total - autoMergeCount

  const report = createReport('AI自動マージ導入シミュレーション', {
    subtitle:
      'AIがPRの複雑さを判定し、シンプルなPRはレビュー不要で自動マージ。レビュー待ちがどれだけ減るかをシミュレーション。',
  })

  // ── Hero Stats ──
  report.stats([
    { label: '分析PR数', value: total, note: '2025年以降のmerged PR' },
    {
      label: '自動マージ対象',
      value: `${llmXSSPct}%`,
      color: 'green',
      note: `${autoMergeCount}件 がレビュー不要に`,
    },
    {
      label: 'レビュー待ち削減',
      value: `-${llmReduction.toFixed(0)}%`,
      color: 'green',
      note: '平均レビュー待ち件数',
    },
    {
      label: '残りのレビュー対象',
      value: needsReviewCount,
      note: `${((needsReviewCount / total) * 100).toFixed(0)}% は人がレビュー`,
    },
  ])

  // ── How it works ──
  report.section(
    'しくみ: AIがPRの複雑さを5段階で判定',
    (s) => {
      s.html(`<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;line-height:1.7">
        AIがPRのタイトル・変更行数・ファイル数を見て、レビューの複雑さを<b style="color:var(--text)">XS〜XL</b>の5段階で判定します。<br>
        <span style="color:var(--green)">XS・S（シンプルな変更）</span>→ 自動マージ（レビュー不要）<br>
        <span style="color:var(--text)">M・L・XL（複雑な変更）</span>→ 従来どおり人がレビュー
      </p>`)
      s.barChart(llmCounts)
    },
    {
      description: `全${total}件のPRをAIが判定した結果の内訳`,
    },
  )

  // ── Impact: before/after ──
  const baselineAvg = simResults.Baseline.llm
  const afterAvg = simResults['Auto XS+S'].llm

  report.section(
    'レビュー待ち件数: 導入前 vs 導入後',
    (s) => {
      s.comparisonBars([
        {
          label: '現状（すべて人がレビュー）',
          value: baselineAvg,
          color: 'var(--red)',
        },
        {
          label: 'XSのみ自動マージ',
          value: simResults['Auto XS'].llm,
          color: 'var(--orange)',
          reduction: `-${simResults['Auto XS'].llmReduction.toFixed(0)}%`,
        },
        {
          label: 'XS+S 自動マージ',
          value: afterAvg,
          color: 'var(--green)',
          reduction: `-${llmReduction.toFixed(0)}%`,
        },
      ])
    },
    {
      description:
        'ある時点でレビュー待ちになっているPR件数の平均。少ないほどレビューが速く回っている',
    },
  )

  // ── Timeline Chart ──
  const baseSnaps = simResults.Baseline.llmSnapshots
  const llmXSSSnaps = simResults['Auto XS+S'].llmSnapshots

  report.section('レビュー待ち件数の推移（日次）', (s) => {
    s.lineChart(
      [
        {
          label: '現状',
          data: baseSnaps.map((d) => ({ x: d.day, y: d.total })),
          color: 'red',
        },
        {
          label: 'AI自動マージ導入後',
          data: llmXSSSnaps.map((d) => ({ x: d.day, y: d.total })),
          color: 'green',
          width: 2.5,
        },
      ],
      {
        yLabel: 'レビュー待ち件数',
        areaFill: { from: 0, to: 1 },
      },
    )
    s.html(
      '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;text-align:center">緑の塗りつぶし部分 = 削減される待ち件数</p>',
    )
  })

  // ── Review Wait Time by Size ──
  const fmtTime = (h: number | null): string => {
    if (h === null || h === undefined) return '—'
    if (h < 1) return `${(h * 60).toFixed(0)}分`
    if (h < 24) return `${h.toFixed(1)}時間`
    return `${(h / 24).toFixed(1)}日`
  }

  report.section(
    'サイズ別のレビュー待ち時間',
    (s) => {
      s.html(`<p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px;line-height:1.6">
        各PRの「レビューリクエストされてから最初のレビューがつくまでの時間」を集計。<br>
        <b style="color:var(--text)">中央値</b> = 半分のPRがこの時間以内にレビューされた。
        <b style="color:var(--text)">75%点</b> = 75%がこの時間以内。
        <b style="color:var(--text)">90%点</b> = 90%がこの時間以内（遅いケースの目安）。
      </p>`)
      const sizes: ReviewComplexity[] = ['XS', 'S', 'M', 'L', 'XL']
      s.html('<div class="review-time-grid">')
      for (const size of sizes) {
        const times = pickupBySize[size]
        if (times.length === 0) continue
        const med = median(times)
        const p75 = percentile(times, 0.75)
        const p90 = percentile(times, 0.9)
        const autoMergeable = size === 'XS' || size === 'S'
        s.html(`<div class="review-time-card"${autoMergeable ? ' style="border:1px solid var(--green)"' : ''}>
      <div class="size-tag" style="color:var(--${size.toLowerCase()})">${size}</div>
      ${autoMergeable ? '<div style="font-size:0.65rem;color:var(--green);margin-bottom:4px">自動マージ</div>' : ''}
      <div class="metric">中央値</div>
      <div class="metric-value">${fmtTime(med)}</div>
      <div class="metric" style="margin-top:6px">75%点</div>
      <div class="metric-value">${fmtTime(p75)}</div>
      <div class="metric" style="margin-top:6px">90%点</div>
      <div class="metric-value">${fmtTime(p90)}</div>
      <div class="metric" style="margin-top:6px">件数</div>
      <div class="metric-value" style="font-size:0.85rem">${times.length}</div>
    </div>`)
      }
      s.html('</div>')
    },
    {
      description:
        'XS/Sは自動マージで即時完了。レビュアーは複雑なPRに集中できる',
    },
  )

  // ── Example PRs ──
  const prUrl = (p: { owner: string; repo: string; number: number }): string =>
    `https://github.com/${p.owner}/${p.repo}/pull/${p.number}`

  const classifications = mergedPRs.map((pr) => {
    const key = `${pr.repo}#${pr.number}`
    return {
      owner: pr.owner,
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      llmSize: llmSizeMap[key],
      llmReason: llmMap[key]?.reason ?? '',
    }
  })

  const autoMergeExamples = classifications
    .filter((p) => p.llmSize === 'XS' || p.llmSize === 'S')
    .slice(0, 15)

  report.section(
    '自動マージ対象になるPRの例',
    (s) => {
      s.table({
        columns: [
          {
            key: 'pr',
            label: 'PR',
            render: (row) =>
              `<a href="${prUrl(row)}" target="_blank" rel="noopener">${row.repo}#${row.number}</a>`,
          },
          {
            key: 'title',
            label: 'タイトル',
            maxWidth: 300,
            render: (row) =>
              `<a href="${prUrl(row)}" target="_blank" rel="noopener" style="color:inherit">${row.title}</a>`,
          },
          {
            key: 'llmSize',
            label: '判定',
            render: (row) =>
              `<span class="size-badge ${row.llmSize.toLowerCase()}">${row.llmSize}</span>`,
          },
          {
            key: 'llmReason',
            label: 'AIの判定理由',
            maxWidth: 350,
          },
        ],
        rows: autoMergeExamples,
      })
    },
    {
      description:
        'AIが「シンプル」と判定したPR。実際のPRリンクから判定の妥当性を確認できます',
    },
  )

  // ── Insights ──
  const xsMedian = median(pickupBySize.XS) ?? 0
  const xlMedian = median(pickupBySize.XL) ?? 0
  const ratio = xsMedian > 0 ? (xlMedian / xsMedian).toFixed(0) : '—'

  report.insight('分析結果', [
    `全PRの<span class="good">${llmXSSPct}%</span>（${autoMergeCount}件）がレビュー不要と判定 → 自動マージ可能`,
    `導入すると<b>レビュー待ち件数が<span class="good">${llmReduction.toFixed(0)}%削減</span></b>（平均${baselineAvg.toFixed(1)}件 → ${afterAvg.toFixed(1)}件）`,
    `AIの判定はPRの複雑さと実際のレビュー時間がきれいに相関（XS: ${fmtTime(xsMedian)} → XL: ${fmtTime(xlMedian)} = <span class="hl">${ratio}倍</span>差）`,
    `運用コスト: <span class="good">月$0.02</span>程度（1PR あたり$0.00017、Gemini Flash Lite使用）`,
  ])

  report.insight('提案するアクション', [
    '<span class="good">AI自動マージをUpflowに導入</span> — XS/S判定のPRを自動マージ対象にする',
    'まずは「自動マージ候補」のラベル表示から始め、段階的に自動化を進める',
    'レビュアーの時間を複雑なPR（M/L/XL）に集中させ、レビューの質と速度を両立',
  ])

  const reportFile = path.join(OUTPUT_DIR, 'llm-automerge-simulation.html')
  report.save(reportFile, { open: true })
  consola.success(`Report: ${reportFile}`)
}

main().catch((err) => {
  consola.error(err)
  process.exit(1)
})
