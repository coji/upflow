/**
 * Golden set ジャッジスクリプト
 *
 * 1件ずつ generateContent で分類し、1件完了ごとに golden.json に追記保存する。
 * Ctrl+C で途中停止しても、完了分は golden.json に残る。
 *
 * Usage:
 *   pnpm tsx lab/classify/judge.ts [--model gemini-3.1-pro-preview] [--file s_sample.json]
 *
 * 全ファイルまとめて実行:
 *   pnpm tsx lab/classify/judge.ts
 *
 * 途中から再開（golden.json に既にあるエントリをスキップ）:
 *   pnpm tsx lab/classify/judge.ts --continue
 */
import type { GoogleGenAI } from '@google/genai'
import 'dotenv/config'
import {
  DEFAULT_FILES,
  DEFAULT_MODEL,
  type GoldenMeta,
  type GoldenSet,
  RESPONSE_SCHEMA,
  SYSTEM_INSTRUCTION,
  buildPrompt,
  loadGolden,
  loadPRsFromSamples,
  prKey,
  printGoldenSummary,
  saveGolden,
} from './judge-common'

const MAX_RETRIES = 5
const INITIAL_BACKOFF_MS = 2_000

async function classifyOne(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  thinkingBudget: number,
): Promise<{ complexity: string; reason: string }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget },
        },
      })

      const text = response.text
      if (!text) throw new Error('Empty response')
      return JSON.parse(text)
    } catch (err) {
      // Don't retry client errors (4xx) — they won't succeed on retry
      const msg = err instanceof Error ? err.message : String(err)
      const is4xx = /"code"\s*:\s*4\d{2}\b/.test(msg)
      if (!is4xx && attempt < MAX_RETRIES) {
        const wait = INITIAL_BACKOFF_MS * 2 ** attempt
        console.warn(
          `  Retry ${attempt + 1}/${MAX_RETRIES} in ${wait}ms — ${err instanceof Error ? err.message : err}`,
        )
        await new Promise((r) => setTimeout(r, wait))
      } else {
        throw err
      }
    }
  }
  throw new Error('unreachable')
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY required (set in .env)')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  let model = DEFAULT_MODEL
  let files = [...DEFAULT_FILES]
  let continueMode = false
  let thinkingBudget = 1024
  let limit = Number.POSITIVE_INFINITY

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      model = args[i + 1]
      i++
    } else if (args[i] === '--file' && args[i + 1]) {
      files = [args[i + 1]]
      i++
    } else if (args[i] === '--continue') {
      continueMode = true
    } else if (args[i] === '--think' && args[i + 1]) {
      thinkingBudget = Number.parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10)
      i++
    }
  }

  console.log(`Model: ${model} (thinkingBudget: ${thinkingBudget})`)

  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })

  const prs = loadPRsFromSamples(files)
  if (prs.length === 0) {
    console.log('No PRs found in sample files.')
    return
  }

  console.log(`\nTotal: ${prs.length} unique PRs to judge sequentially`)

  const golden: GoldenSet = loadGolden()
  const toJudge = continueMode ? prs.filter((pr) => !golden[prKey(pr)]) : prs

  if (continueMode && toJudge.length < prs.length) {
    console.log(
      `--continue: skipping ${prs.length - toJudge.length} already judged, ${toJudge.length} remaining`,
    )
  }

  const limited = toJudge.slice(0, limit)
  if (limit < toJudge.length) {
    console.log(`--limit: processing ${limited.length} of ${toJudge.length}`)
  }

  if (limited.length === 0) {
    console.log('All PRs already judged.')
    printGoldenSummary(golden)
    return
  }

  let completed = 0
  let errors = 0

  for (const pr of limited) {
    const key = prKey(pr)
    completed++
    const progress = `[${completed}/${limited.length}]`

    try {
      const prompt = buildPrompt(pr)
      const result = await classifyOne(ai, model, prompt, thinkingBudget)

      golden[key] = {
        number: pr.number,
        repositoryId: pr.repository_id,
        title: pr.title,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        currentLabel: pr.current_label,
        goldenLabel: result.complexity,
        reason: result.reason,
        judgedAt: new Date().toISOString(),
        judgedModel: model,
        prompt,
      }

      // Save after each entry — safe to Ctrl+C
      saveGolden(golden)

      console.log(
        `${progress} ${key}: ${pr.current_label} → ${result.complexity} ${pr.current_label !== result.complexity ? '⚡' : '✓'}`,
      )
    } catch (err) {
      errors++
      console.error(
        `${progress} ${key}: FAILED after ${MAX_RETRIES} retries — ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  // Save with meta envelope + archive
  const meta: GoldenMeta = {
    createdAt: new Date().toISOString(),
    model,
    thinkingBudget,
    sampleFiles: files,
    entryCount: Object.keys(golden).length,
  }
  saveGolden(golden, meta)

  console.log(`\nDone. ${completed - errors} succeeded, ${errors} errors.`)
  printGoldenSummary(golden)
}

main()
