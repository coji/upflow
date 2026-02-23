/**
 * 004 - LLM分類 vs ルールベース分類の比較
 *
 * ルールベース(classify.ts)とLLM(Gemini Flash)で
 * PRのレビュー複雑度を分類し、差異を分析する。
 *
 * 特に「ルールベースでL判定だがLLMではM以下」のケース（偽陽性）と
 * 「ルールベースでM以下だがLLMではL以上」のケース（偽陰性）に注目。
 *
 * Usage:
 *   pnpm tsx lab/experiments/004-llm-classification-comparison.ts
 *   pnpm tsx lab/experiments/004-llm-classification-comparison.ts --sample 50
 *   pnpm tsx lab/experiments/004-llm-classification-comparison.ts --only-l
 *
 * 環境変数:
 *   GEMINI_API_KEY — Google AI Studio APIキー (必須、.env に設定可)
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

// Parse args
const args = process.argv.slice(2)
const sampleIdx = args.indexOf('--sample')
const sampleSize = sampleIdx >= 0 ? Number(args[sampleIdx + 1]) : 30
const onlyL = args.includes('--only-l')

interface ComparisonResult {
  pr: {
    owner: string
    repo: string
    number: number
    title: string
    author: string | undefined
    additions: number
    deletions: number
    changedFiles: number
  }
  ruleBasedSize: PRSize
  llm: LLMClassification
  agreement: boolean
  direction: 'agree' | 'rule-higher' | 'llm-higher'
}

const sizeOrder: Record<string, number> = { XS: 0, S: 1, M: 2, L: 3, XL: 4 }

function compareSizes(
  rule: PRSize,
  llm: ReviewComplexity,
): 'agree' | 'rule-higher' | 'llm-higher' {
  const diff = sizeOrder[rule] - sizeOrder[llm]
  if (diff === 0) return 'agree'
  return diff > 0 ? 'rule-higher' : 'llm-higher'
}

async function main() {
  // Load data
  const sizesFile = path.join(DATA_DIR, 'pr-sizes.json')
  if (!fs.existsSync(sizesFile)) {
    consola.error(`Data not found: ${sizesFile}`)
    consola.info('Run: pnpm tsx lab/fetch.ts --only sizes')
    process.exit(1)
  }

  const allPRs: PRSizeInfo[] = JSON.parse(fs.readFileSync(sizesFile, 'utf-8'))
  const mergedPRs = allPRs.filter(
    (pr) => pr.mergedAt && pr.createdAt >= '2025-01-01',
  )

  consola.info(`Total merged PRs (2025+): ${mergedPRs.length}`)

  // Select sample
  let sample: PRSizeInfo[]
  if (onlyL) {
    const lPRs = mergedPRs.filter((pr) => classifyPR(pr) === 'L')
    consola.info(`Rule-based L PRs: ${lPRs.length}`)
    sample = lPRs.slice(0, sampleSize)
  } else {
    const bySize: Record<PRSize, PRSizeInfo[]> = {
      XS: [],
      S: [],
      M: [],
      L: [],
      XL: [],
    }
    for (const pr of mergedPRs) {
      bySize[classifyPR(pr)].push(pr)
    }

    sample = []
    const perSize = Math.max(2, Math.floor(sampleSize / 5))
    for (const size of ['XS', 'S', 'M', 'L', 'XL'] as PRSize[]) {
      const shuffled = bySize[size].sort(() => Math.random() - 0.5)
      sample.push(...shuffled.slice(0, perSize))
    }
    sample = sample.slice(0, sampleSize)
  }

  consola.info(`Sample size: ${sample.length}`)
  consola.start('Classifying with LLM...')

  // LLM classification
  const batchResult = await batchClassifyWithLLM(sample, {
    concurrency: 5,
    delayMs: 300,
    onProgress: (done, total, usage) => {
      const cost = estimateCost(usage)
      consola.info(
        `  Progress: ${done}/${total}  (${usage.promptTokens.toLocaleString()} prompt + ${usage.candidatesTokens.toLocaleString()} output tokens, $${cost.toFixed(4)})`,
      )
    },
  })

  // Cost summary
  const { totalUsage, estimatedCost } = batchResult
  consola.info('\n=== Cost Summary ===')
  consola.info(`Prompt tokens:  ${totalUsage.promptTokens.toLocaleString()}`)
  consola.info(
    `Output tokens:  ${totalUsage.candidatesTokens.toLocaleString()}`,
  )
  consola.info(`Total tokens:   ${totalUsage.totalTokens.toLocaleString()}`)
  consola.info(`Estimated cost: $${estimatedCost.toFixed(4)}`)
  if (sample.length > 0) {
    const avgPrompt = totalUsage.promptTokens / sample.length
    const avgOutput = totalUsage.candidatesTokens / sample.length
    const costPerPR = estimatedCost / sample.length
    consola.info(
      `Per PR avg:     ${avgPrompt.toFixed(0)} prompt + ${avgOutput.toFixed(0)} output tokens ($${costPerPR.toFixed(5)}/PR)`,
    )
    consola.info(
      `Projected ${mergedPRs.length} PRs: $${(costPerPR * mergedPRs.length).toFixed(2)}`,
    )
  }

  // Compare
  const results: ComparisonResult[] = sample.map((pr) => {
    const key = `${pr.repo}#${pr.number}`
    const ruleSize = classifyPR(pr)
    const llm = batchResult.classifications.get(key) ?? {
      complexity: 'M' as ReviewComplexity,
      reason: 'N/A',
      risk_areas: [],
      suggested_reviewers: [],
    }

    return {
      pr: {
        owner: pr.owner,
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        author: pr.author?.login,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
      },
      ruleBasedSize: ruleSize,
      llm,
      agreement: ruleSize === llm.complexity,
      direction: compareSizes(ruleSize, llm.complexity),
    }
  })

  // Summary
  const agreementCount = results.filter((r) => r.agreement).length
  const ruleHigher = results.filter((r) => r.direction === 'rule-higher')
  const llmHigher = results.filter((r) => r.direction === 'llm-higher')

  consola.info('\n=== Comparison Summary ===')
  consola.info(`Total: ${results.length}`)
  consola.info(
    `Agreement: ${agreementCount} (${((agreementCount / results.length) * 100).toFixed(1)}%)`,
  )
  consola.info(`Rule higher (potential false positives): ${ruleHigher.length}`)
  consola.info(`LLM higher (potential false negatives): ${llmHigher.length}`)

  // Confusion matrix
  consola.info('\n=== Confusion Matrix (Rule → LLM) ===')
  const matrix: Record<string, Record<string, number>> = {}
  for (const r of results) {
    if (!matrix[r.ruleBasedSize]) matrix[r.ruleBasedSize] = {}
    matrix[r.ruleBasedSize][r.llm.complexity] =
      (matrix[r.ruleBasedSize][r.llm.complexity] ?? 0) + 1
  }
  const sizes: PRSize[] = ['XS', 'S', 'M', 'L', 'XL']
  consola.info(
    `${'Rule\\LLM'.padEnd(10)} ${sizes.map((s) => s.padStart(4)).join('')}`,
  )
  for (const rule of sizes) {
    if (!matrix[rule]) continue
    const row = sizes.map((llm) => String(matrix[rule]?.[llm] ?? 0).padStart(4))
    consola.info(`${rule.padEnd(10)} ${row.join('')}`)
  }

  // Interesting disagreements
  if (ruleHigher.length > 0) {
    consola.info('\n=== Rule Higher (False Positives?) ===')
    for (const r of ruleHigher.slice(0, 10)) {
      consola.info(`  ${r.pr.repo}#${r.pr.number} "${r.pr.title}"`)
      consola.info(
        `    Rule: ${r.ruleBasedSize} → LLM: ${r.llm.complexity} — ${r.llm.reason}`,
      )
    }
  }

  if (llmHigher.length > 0) {
    consola.info('\n=== LLM Higher (False Negatives?) ===')
    for (const r of llmHigher.slice(0, 10)) {
      consola.info(`  ${r.pr.repo}#${r.pr.number} "${r.pr.title}"`)
      consola.info(
        `    Rule: ${r.ruleBasedSize} → LLM: ${r.llm.complexity} — ${r.llm.reason}`,
      )
    }
  }

  // Save
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const outputFile = path.join(OUTPUT_DIR, 'llm-classification-comparison.json')
  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      {
        meta: {
          sampleSize: results.length,
          onlyL,
          timestamp: new Date().toISOString(),
          cost: {
            totalUsage,
            estimatedCost,
            perPR: sample.length > 0 ? estimatedCost / sample.length : 0,
            projectedFullCost:
              sample.length > 0
                ? (estimatedCost / sample.length) * mergedPRs.length
                : 0,
          },
        },
        summary: {
          agreementRate: agreementCount / results.length,
          ruleHigherCount: ruleHigher.length,
          llmHigherCount: llmHigher.length,
        },
        confusionMatrix: matrix,
        results,
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
