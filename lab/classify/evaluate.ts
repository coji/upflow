/**
 * プロンプト評価スクリプト
 *
 * golden.json と本番分類器(Gemini)の分類結果を比較してプロンプトの精度を評価する。
 *
 * Usage:
 *   pnpm tsx lab/classify/evaluate.ts
 *   pnpm tsx lab/classify/evaluate.ts --model gemini-2.5-flash-lite
 *   pnpm tsx lab/classify/evaluate.ts --limit 10
 *   pnpm tsx lab/classify/evaluate.ts --continue   # 前回の eval を途中から再開
 *
 * golden.json が必要。先に judge.ts を実行すること。
 */
import { GoogleGenAI } from '@google/genai'
import Database from 'better-sqlite3'
import 'dotenv/config'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  DATA_DIR,
  GOLDEN_PATH,
  RESPONSE_SCHEMA,
  buildPrompt,
  loadGoldenFile,
  type GoldenEntry,
  type PRRecord,
} from './judge-common'

const DB_PATH = path.join('data', 'tenant_iris.db')
const EVALS_DIR = path.join(DATA_DIR, 'evals')
const PROMPT_PATH = path.join('batch', 'lib', 'llm-classify.ts')

const LEVELS = ['XS', 'S', 'M', 'L', 'XL'] as const
function levelIndex(level: string): number {
  return LEVELS.indexOf(level as (typeof LEVELS)[number])
}

const MAX_RETRIES = 5
const INITIAL_BACKOFF_MS = 2_000

function extractSystemInstruction(): string {
  const source = fs.readFileSync(PROMPT_PATH, 'utf-8')
  const match = source.match(/const SYSTEM_INSTRUCTION = `([\s\S]*?)`/)
  if (!match)
    throw new Error('Could not extract SYSTEM_INSTRUCTION from source')
  return match[1]
}

function promptHash(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 8)
}

/** Convert GoldenEntry to PRRecord shape for buildPrompt */
function goldenEntryToPRRecord(entry: GoldenEntry): PRRecord {
  return {
    number: entry.number,
    repository_id: entry.repositoryId,
    title: entry.title,
    author: null,
    additions: entry.additions,
    deletions: entry.deletions,
    changed_files: entry.changedFiles,
    current_label: entry.currentLabel,
    complexity_reason: '',
  }
}

async function classifyOne(
  ai: GoogleGenAI,
  model: string,
  systemPrompt: string,
  prPrompt: string,
): Promise<{ complexity: string; reason: string }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      })

      const text = response.text
      if (!text) throw new Error('Empty response')
      return JSON.parse(text)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const is4xx = /"code"\s*:\s*4\d{2}\b/.test(msg)
      if (is4xx) throw err // Don't retry client errors
      if (attempt < MAX_RETRIES) {
        const wait = INITIAL_BACKOFF_MS * 2 ** attempt
        console.warn(
          `  Retry ${attempt + 1}/${MAX_RETRIES} in ${wait}ms — ${msg}`,
        )
        await new Promise((r) => setTimeout(r, wait))
      } else {
        throw err
      }
    }
  }
  throw new Error('unreachable')
}

interface ConfusionMatrix {
  matrix: number[][]
  perClass: {
    label: string
    precision: number
    recall: number
    f1: number
    count: number
  }[]
  accuracy: number
  avgDrift: number
}

function computeMetrics(
  predictions: { golden: string; predicted: string }[],
): ConfusionMatrix {
  const n = LEVELS.length
  const matrix = Array.from({ length: n }, () => Array(n).fill(0) as number[])

  let correct = 0
  let totalDrift = 0

  for (const { golden, predicted } of predictions) {
    const gi = levelIndex(golden)
    const pi = levelIndex(predicted)
    if (gi >= 0 && pi >= 0) {
      matrix[gi][pi]++
      if (gi === pi) correct++
      totalDrift += Math.abs(gi - pi)
    }
  }

  const perClass = LEVELS.map((label, i) => {
    const tp = matrix[i][i]
    const fp = matrix.reduce((sum, row, j) => sum + (j !== i ? row[i] : 0), 0)
    const fn = matrix[i].reduce((sum, val, j) => sum + (j !== i ? val : 0), 0)
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0
    const f1 =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0
    const count = matrix[i].reduce((a, b) => a + b, 0)
    return { label, precision, recall, f1, count }
  })

  return {
    matrix,
    perClass,
    accuracy: predictions.length > 0 ? correct / predictions.length : 0,
    avgDrift: predictions.length > 0 ? totalDrift / predictions.length : 0,
  }
}

function printMetrics(metrics: ConfusionMatrix) {
  console.log('\n=== Confusion Matrix ===')
  console.log(`${''.padStart(8)}${LEVELS.map((l) => l.padStart(5)).join('')}`)
  for (let i = 0; i < LEVELS.length; i++) {
    const row = metrics.matrix[i].map((v) => String(v).padStart(5)).join('')
    console.log(`${LEVELS[i].padStart(5)}   ${row}`)
  }
  console.log('       (rows=golden, cols=predicted)')

  console.log('\n=== Per-class Metrics ===')
  console.log(
    `${'Label'.padEnd(6)} ${'Prec'.padStart(6)} ${'Recall'.padStart(6)} ${'F1'.padStart(6)} ${'Count'.padStart(6)}`,
  )
  for (const c of metrics.perClass) {
    console.log(
      `${c.label.padEnd(6)} ${(c.precision * 100).toFixed(1).padStart(5)}% ${(c.recall * 100).toFixed(1).padStart(5)}% ${(c.f1 * 100).toFixed(1).padStart(5)}% ${String(c.count).padStart(6)}`,
    )
  }

  console.log(`\nAccuracy: ${(metrics.accuracy * 100).toFixed(1)}%`)
  console.log(`Avg drift: ${metrics.avgDrift.toFixed(2)} levels`)
}

interface EvalResult {
  timestamp: string
  model: string
  promptHash: string
  promptPreview: string
  goldenMeta: { createdAt: string; model: string; entryCount: number } | null
  metrics: {
    accuracy: number
    avgDrift: number
    perClass: ConfusionMatrix['perClass']
  }
  disagreements: {
    key: string
    title: string
    stats: string
    golden: string
    predicted: string
    reason: string
  }[]
  evaluatedKeys: string[]
  totalEvaluated: number
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY required (set in .env)')
    process.exit(1)
  }

  if (!fs.existsSync(GOLDEN_PATH)) {
    console.error('golden.json not found. Run judge.ts first.')
    process.exit(1)
  }

  // Parse args
  const args = process.argv.slice(2)
  let model = 'gemini-3-flash-preview'
  let limit = Number.POSITIVE_INFINITY
  let continueMode = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      model = args[i + 1]
      i++
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--continue') {
      continueMode = true
    }
  }

  // Single parse of golden.json
  const goldenFile = loadGoldenFile()
  const golden =
    goldenFile?.entries ??
    (() => {
      // Legacy flat format fallback
      const raw = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf-8'))
      return raw as Record<string, GoldenEntry>
    })()
  const goldenEntries = Object.entries(golden)
  console.log(`Golden set: ${goldenEntries.length} entries`)

  // Extract current prompt from source
  const systemPrompt = extractSystemInstruction()
  const hash = promptHash(systemPrompt)
  console.log(`Prompt hash: ${hash}`)
  console.log(`Prompt extracted from ${PROMPT_PATH}`)
  console.log(`Model: ${model}`)

  // --continue: find latest eval with same promptHash and skip already-evaluated keys
  let alreadyEvaluated = new Set<string>()
  let previousResult: EvalResult | null = null
  if (continueMode) {
    const evalFiles = fs.existsSync(EVALS_DIR)
      ? fs
          .readdirSync(EVALS_DIR)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .reverse()
      : []
    for (const f of evalFiles) {
      try {
        const data: EvalResult = JSON.parse(
          fs.readFileSync(path.join(EVALS_DIR, f), 'utf-8'),
        )
        if (data.promptHash === hash) {
          previousResult = data
          // Use evaluatedKeys if available, fall back to disagreements only
          const keys =
            data.evaluatedKeys ?? data.disagreements.map((d) => d.key)
          for (const k of keys) alreadyEvaluated.add(k)
          console.log(
            `--continue: found ${f} with ${data.totalEvaluated} entries, skipping ${alreadyEvaluated.size}`,
          )
          break
        }
      } catch {
        // skip invalid files
      }
    }
    if (!previousResult) {
      console.log('--continue: no previous eval found for this prompt hash')
    }
  }

  const db = new Database(DB_PATH, { readonly: true })
  const ai = new GoogleGenAI({ apiKey })

  const predictions: { golden: string; predicted: string; key: string }[] = []
  const disagreements: EvalResult['disagreements'] = []
  const evaluatedKeys: string[] = []

  // If continuing, carry forward previous results
  if (previousResult) {
    for (const d of previousResult.disagreements) {
      disagreements.push(d)
    }
    if (previousResult.evaluatedKeys) {
      evaluatedKeys.push(...previousResult.evaluatedKeys)
    }
  }

  let toEvaluate = goldenEntries
  if (continueMode && alreadyEvaluated.size > 0) {
    toEvaluate = goldenEntries.filter(([key]) => !alreadyEvaluated.has(key))
    console.log(
      `--continue: skipping ${goldenEntries.length - toEvaluate.length}, ${toEvaluate.length} remaining`,
    )
  }

  const limited = toEvaluate.slice(0, limit)
  if (limit < toEvaluate.length) {
    console.log(`--limit: processing ${limited.length} of ${toEvaluate.length}`)
  }

  let processed = 0
  let skipped = 0
  for (const [key, entry] of limited) {
    processed++

    try {
      const prPrompt = buildPrompt(goldenEntryToPRRecord(entry), db)
      const result = await classifyOne(ai, model, systemPrompt, prPrompt)

      predictions.push({
        golden: entry.goldenLabel,
        predicted: result.complexity,
        key,
      })
      evaluatedKeys.push(key)

      if (result.complexity !== entry.goldenLabel) {
        disagreements.push({
          key,
          title: entry.title.slice(0, 50),
          stats: `+${entry.additions}/-${entry.deletions} ${entry.changedFiles}f`,
          golden: entry.goldenLabel,
          predicted: result.complexity,
          reason: result.reason,
        })
      }

      if (processed % 20 === 0) {
        console.log(`Evaluated ${processed}/${limited.length}...`)
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 200))
    } catch (err) {
      skipped++
      const msg = err instanceof Error ? err.message : String(err)
      const is4xx = /"code"\s*:\s*4\d{2}\b/.test(msg)
      if (is4xx) {
        console.warn(`Skipped (4xx): ${key} — ${msg}`)
      } else {
        console.warn(`Failed: ${key} — ${msg}`)
      }
    }
  }

  db.close()

  // Results
  const metrics = computeMetrics(predictions)
  printMetrics(metrics)

  // Show disagreements
  if (disagreements.length > 0) {
    console.log(`\n=== Disagreements (${disagreements.length}) ===`)
    for (const d of disagreements.slice(0, 30)) {
      const drift = Math.abs(levelIndex(d.golden) - levelIndex(d.predicted))
      const marker = drift >= 2 ? '!!' : '  '
      console.log(
        `${marker} ${d.golden} → ${d.predicted} | ${d.stats} | ${d.title}`,
      )
    }
    if (disagreements.length > 30) {
      console.log(`  ... and ${disagreements.length - 30} more`)
    }
  }

  // Save results
  fs.mkdirSync(EVALS_DIR, { recursive: true })
  const resultPath = path.join(
    EVALS_DIR,
    `eval_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`,
  )

  const evalResult: EvalResult = {
    timestamp: new Date().toISOString(),
    model,
    promptHash: hash,
    promptPreview: systemPrompt.slice(0, 200),
    goldenMeta: goldenFile
      ? {
          createdAt: goldenFile.meta.createdAt,
          model: goldenFile.meta.model,
          entryCount: goldenFile.meta.entryCount,
        }
      : null,
    metrics: {
      accuracy: metrics.accuracy,
      avgDrift: metrics.avgDrift,
      perClass: metrics.perClass,
    },
    disagreements,
    evaluatedKeys,
    totalEvaluated: predictions.length,
  }

  fs.writeFileSync(resultPath, JSON.stringify(evalResult, null, 2))
  console.log(`\nResults saved to ${resultPath}`)
  if (skipped > 0) console.log(`Skipped: ${skipped}`)
}

main().catch(console.error)
