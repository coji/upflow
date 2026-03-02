/**
 * プロンプト評価スクリプト
 *
 * golden.json と Gemini の分類結果を比較してプロンプトの精度を評価する。
 *
 * Usage:
 *   pnpm tsx lab/scripts/evaluate.ts
 *
 * golden.json が必要。先に judge.ts を実行すること。
 */
import { GoogleGenAI, Type } from '@google/genai'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.join(import.meta.dirname, 'data')
const GOLDEN_PATH = path.join(DATA_DIR, 'golden.json')
const DB_PATH = path.join('data', 'tenant_iris.db')

// Import the current prompt from the actual source
const PROMPT_PATH = path.join('batch', 'lib', 'llm-classify.ts')

interface GoldenEntry {
  number: number
  repositoryId: string
  title: string
  additions: number | null
  deletions: number | null
  changedFiles: number | null
  currentLabel: string
  goldenLabel: string
  reason: string
}

type GoldenSet = Record<string, GoldenEntry>

const LEVELS = ['XS', 'S', 'M', 'L', 'XL'] as const
function levelIndex(level: string): number {
  return LEVELS.indexOf(level as (typeof LEVELS)[number])
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    complexity: {
      type: Type.STRING,
      enum: ['XS', 'S', 'M', 'L', 'XL'],
    },
    reason: {
      type: Type.STRING,
    },
  },
  required: ['complexity', 'reason'],
} as const

async function classifyWithGemini(
  ai: GoogleGenAI,
  model: string,
  systemPrompt: string,
  pr: {
    number: number
    title: string
    author: string | null
    body: string | null
    sourceBranch: string | null
    targetBranch: string | null
    additions: number
    deletions: number
    changedFiles: number
    files: { path: string; additions: number; deletions: number }[]
  },
): Promise<{ complexity: string; reason: string }> {
  const fileList =
    pr.files.length > 0
      ? pr.files
          .slice(0, 50)
          .map((f) => `  ${f.path} (+${f.additions}/-${f.deletions})`)
          .join('\n')
      : '(no file list available)'

  const branchesTag =
    pr.sourceBranch && pr.targetBranch
      ? `\n  <branches>${pr.sourceBranch} → ${pr.targetBranch}</branches>`
      : ''

  const descriptionTag = pr.body
    ? `\n  <description>${pr.body.slice(0, 2000)}</description>`
    : ''

  const prompt = `<pr>
  <number>${pr.number}</number>
  <title>${pr.title}</title>
  <author>${pr.author ?? 'unknown'}</author>${branchesTag}
  <stats additions="${pr.additions}" deletions="${pr.deletions}" files="${pr.changedFiles}" />${descriptionTag}
  <files>
${fileList}
  </files>
</pr>

Classify this PR's review complexity.`

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
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
}

function extractSystemInstruction(): string {
  const source = fs.readFileSync(PROMPT_PATH, 'utf-8')
  const match = source.match(/const SYSTEM_INSTRUCTION = `([\s\S]*?)`/)
  if (!match)
    throw new Error('Could not extract SYSTEM_INSTRUCTION from source')
  return match[1]
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

  const golden: GoldenSet = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf-8'))
  const goldenEntries = Object.entries(golden)
  console.log(`Golden set: ${goldenEntries.length} entries`)

  // Extract current prompt from source
  const systemPrompt = extractSystemInstruction()
  console.log(`Prompt extracted from ${PROMPT_PATH}`)
  console.log(`First 100 chars: ${systemPrompt.slice(0, 100)}...`)

  // Parse --model flag
  const args = process.argv.slice(2)
  const modelIdx = args.indexOf('--model')
  const model =
    modelIdx >= 0 && args[modelIdx + 1]
      ? args[modelIdx + 1]
      : 'gemini-2.5-flash-lite'
  console.log(`Model: ${model}`)

  // Load raw PR data for file lists
  const db = new Database(DB_PATH, { readonly: true })
  const ai = new GoogleGenAI({ apiKey })

  const predictions: { golden: string; predicted: string; key: string }[] = []
  const disagreements: {
    key: string
    title: string
    stats: string
    golden: string
    predicted: string
    reason: string
  }[] = []

  let processed = 0
  for (const [key, entry] of goldenEntries) {
    processed++

    // Get raw PR data for file list
    const raw = db
      .prepare(
        'SELECT pull_request FROM github_raw_data WHERE repository_id = ? AND pull_request_number = ?',
      )
      .get(entry.repositoryId, entry.number) as
      | { pull_request: string }
      | undefined

    const rawPr = raw ? JSON.parse(raw.pull_request) : null
    const files = rawPr?.files ?? []

    try {
      const result = await classifyWithGemini(ai, model, systemPrompt, {
        number: entry.number,
        title: entry.title,
        author: null,
        body: rawPr?.body ?? null,
        sourceBranch: rawPr?.sourceBranch ?? null,
        targetBranch: rawPr?.targetBranch ?? null,
        additions: entry.additions ?? 0,
        deletions: entry.deletions ?? 0,
        changedFiles: entry.changedFiles ?? 0,
        files,
      })

      predictions.push({
        golden: entry.goldenLabel,
        predicted: result.complexity,
        key,
      })

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
        console.log(`Evaluated ${processed}/${goldenEntries.length}...`)
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 200))
    } catch (err) {
      console.warn(
        `Failed: ${key} — ${err instanceof Error ? err.message : err}`,
      )
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
  const evalsDir = path.join(DATA_DIR, 'evals')
  fs.mkdirSync(evalsDir, { recursive: true })
  const resultPath = path.join(
    evalsDir,
    `eval_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`,
  )
  fs.writeFileSync(
    resultPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        model,
        promptPreview: systemPrompt.slice(0, 200),
        metrics: {
          accuracy: metrics.accuracy,
          avgDrift: metrics.avgDrift,
          perClass: metrics.perClass,
        },
        disagreements,
        totalEvaluated: predictions.length,
      },
      null,
      2,
    ),
  )
  console.log(`\nResults saved to ${resultPath}`)
}

main().catch(console.error)
