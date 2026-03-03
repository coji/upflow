/**
 * Golden set ジャッジスクリプト（バッチ版）
 *
 * lab/classify/data/samples/ の検証対象 JSON を Gemini Batch Prediction API に投げて正解ラベルを生成する。
 * Batch API により 50% コスト削減＋レート制限回避。
 *
 * 成功時は golden.json を丸ごと上書きする（追記マージしない）。
 * 失敗時は golden.json を更新しない（前回の結果がそのまま残る）。
 *
 * Usage:
 *   pnpm tsx lab/classify/judge.ts [--model gemini-3.1-pro-preview] [--file xl_all.json]
 *
 * 全ファイルまとめて実行:
 *   pnpm tsx lab/classify/judge.ts
 *
 * 中断したジョブを再開:
 *   pnpm tsx lab/classify/judge.ts --resume
 *   pnpm tsx lab/classify/judge.ts --resume batches/xxxx  # ジョブ名を直接指定
 *
 * ジョブの状態確認:
 *   pnpm tsx lab/classify/judge.ts --status
 *
 * ジョブをキャンセル:
 *   pnpm tsx lab/classify/judge.ts --cancel
 */
import { type GoogleGenAI, JobState } from '@google/genai'
import Database from 'better-sqlite3'
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import {
  BATCH_JOB_PATH,
  DEFAULT_FILES,
  DEFAULT_MODEL,
  type GoldenSet,
  type PRRecord,
  RESPONSE_SCHEMA,
  SYSTEM_INSTRUCTION,
  buildPrompt,
  loadPRsFromSamples,
  prKey,
  printGoldenSummary,
  saveGolden,
} from './judge-common'

const POLL_INTERVAL_MS = 30_000
const MAX_CONSECUTIVE_ERRORS = 10

interface BatchJobInfo {
  name: string
  createdAt: string
  model: string
  prCount: number
}

function saveBatchJob(info: BatchJobInfo) {
  fs.writeFileSync(BATCH_JOB_PATH, JSON.stringify(info, null, 2))
}

function loadBatchJob(): BatchJobInfo | null {
  if (!fs.existsSync(BATCH_JOB_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(BATCH_JOB_PATH, 'utf-8'))
  } catch {
    return null
  }
}

function removeBatchJob() {
  if (fs.existsSync(BATCH_JOB_PATH)) {
    fs.unlinkSync(BATCH_JOB_PATH)
  }
}

const TERMINAL_STATES = new Set([
  JobState.JOB_STATE_SUCCEEDED,
  JobState.JOB_STATE_FAILED,
  JobState.JOB_STATE_CANCELLED,
  JobState.JOB_STATE_PARTIALLY_SUCCEEDED,
])

async function pollUntilDone(
  ai: GoogleGenAI,
  jobName: string,
): Promise<Awaited<ReturnType<GoogleGenAI['batches']['get']>>> {
  let consecutiveErrors = 0
  let current = await ai.batches.get({ name: jobName })

  while (!TERMINAL_STATES.has(current.state!)) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    try {
      current = await ai.batches.get({ name: jobName })
      consecutiveErrors = 0
      console.log(
        `  Status: ${current.state} (${new Date().toLocaleTimeString()})`,
      )
    } catch (err) {
      consecutiveErrors++
      console.warn(
        `  Poll error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${err instanceof Error ? err.message : err}`,
      )
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error(
          `Giving up after ${MAX_CONSECUTIVE_ERRORS} consecutive poll errors. Job name preserved in ${BATCH_JOB_PATH} — use --resume to retry.`,
        )
      }
    }
  }

  return current
}

function extractResults(
  responses: Array<{
    metadata?: { pr_key?: string }
    error?: { message?: string }
    response?: { text?: string }
  }>,
): Map<string, { label: string; reason: string }> {
  const results = new Map<string, { label: string; reason: string }>()

  for (const resp of responses) {
    const key = resp.metadata?.pr_key
    if (!key) continue

    if (resp.error) {
      console.error(`  Error for ${key}: ${resp.error.message}`)
      continue
    }

    const text = resp.response?.text
    if (text) {
      try {
        const parsed = JSON.parse(text)
        results.set(key, {
          label: parsed.complexity,
          reason: parsed.reason ?? '',
        })
      } catch {
        console.error(`  Parse error for ${key}`)
      }
    }
  }

  return results
}

async function judgePRsBatch(
  ai: GoogleGenAI,
  model: string,
  prs: PRRecord[],
  db: Database.Database,
): Promise<Map<string, { label: string; reason: string }>> {
  const inlinedRequests = prs.map((pr) => ({
    contents: buildPrompt(pr, db),
    metadata: { pr_key: prKey(pr) },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 1024 },
    },
  }))

  console.log(`Creating batch job with ${inlinedRequests.length} requests...`)

  const job = await ai.batches.create({
    model,
    src: { inlinedRequests },
  })

  if (!job.name) {
    throw new Error('Batch job creation failed: no job name returned')
  }

  console.log(`Batch job created: ${job.name}`)

  saveBatchJob({
    name: job.name,
    createdAt: new Date().toISOString(),
    model,
    prCount: prs.length,
  })

  const current = await pollUntilDone(ai, job.name)

  if (
    current.state !== JobState.JOB_STATE_SUCCEEDED &&
    current.state !== JobState.JOB_STATE_PARTIALLY_SUCCEEDED
  ) {
    throw new Error(`Batch job failed with state: ${current.state}`)
  }

  const responses = current.dest?.inlinedResponses ?? []
  console.log(`Batch completed: ${responses.length} responses`)

  removeBatchJob()

  return extractResults(responses)
}

async function resumeJob(
  ai: GoogleGenAI,
  jobName: string,
): Promise<Map<string, { label: string; reason: string }>> {
  console.log(`Resuming job: ${jobName}`)

  const current = await pollUntilDone(ai, jobName)

  if (
    current.state !== JobState.JOB_STATE_SUCCEEDED &&
    current.state !== JobState.JOB_STATE_PARTIALLY_SUCCEEDED
  ) {
    throw new Error(`Batch job failed with state: ${current.state}`)
  }

  const responses = current.dest?.inlinedResponses ?? []
  console.log(`Batch completed: ${responses.length} responses`)

  removeBatchJob()

  return extractResults(responses)
}

function buildGoldenFromResults(
  results: Map<string, { label: string; reason: string }>,
  prs: PRRecord[],
  model: string,
): GoldenSet {
  const now = new Date().toISOString()
  const golden: GoldenSet = {}

  for (const pr of prs) {
    const key = prKey(pr)
    const result = results.get(key)
    if (!result) continue

    golden[key] = {
      number: pr.number,
      repositoryId: pr.repository_id,
      title: pr.title,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      currentLabel: pr.current_label,
      goldenLabel: result.label,
      reason: result.reason,
      judgedAt: now,
      judgedModel: model,
    }
  }

  return golden
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
  let resumeJobName: string | null = null
  let statusMode = false
  let cancelMode = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      model = args[i + 1]
      i++
    } else if (args[i] === '--file' && args[i + 1]) {
      files = [args[i + 1]]
      i++
    } else if (args[i] === '--resume') {
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        resumeJobName = args[i + 1]
        i++
      } else {
        const saved = loadBatchJob()
        if (!saved?.name) {
          console.error(
            'No saved job found in batch-job.json. Pass a job name: --resume batches/...',
          )
          process.exit(1)
        }
        resumeJobName = saved.name
      }
    } else if (args[i] === '--status') {
      statusMode = true
    } else if (args[i] === '--cancel') {
      cancelMode = true
    }
  }

  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })

  // --status: show job state and exit
  if (statusMode) {
    const saved = loadBatchJob()
    if (!saved?.name) {
      console.log('No saved job found in batch-job.json')
      process.exit(0)
    }
    console.log(`Job: ${saved.name}`)
    console.log(`Created: ${saved.createdAt}`)
    console.log(`Model: ${saved.model}`)
    console.log(`PR count: ${saved.prCount}`)
    try {
      const job = await ai.batches.get({ name: saved.name })
      console.log(`State: ${job.state}`)
    } catch (err) {
      console.error(
        `Failed to fetch job status: ${err instanceof Error ? err.message : err}`,
      )
    }
    return
  }

  // --cancel: cancel the running job and clean up
  if (cancelMode) {
    const saved = loadBatchJob()
    if (!saved?.name) {
      console.log('No saved job found in batch-job.json')
      process.exit(0)
    }
    console.log(`Cancelling job: ${saved.name}`)
    try {
      await ai.batches.cancel({ name: saved.name })
      console.log('Cancel requested.')
      const job = await ai.batches.get({ name: saved.name })
      console.log(`State: ${job.state}`)
    } catch (err) {
      console.error(
        `Failed to cancel: ${err instanceof Error ? err.message : err}`,
      )
    }
    removeBatchJob()
    console.log('Removed batch-job.json')
    return
  }

  // --resume: poll and collect results for an existing job
  if (resumeJobName) {
    const saved = loadBatchJob()
    const resumeModel = saved?.model ?? model
    const results = await resumeJob(ai, resumeJobName)

    // For resumed jobs, build golden from results with minimal info
    const now = new Date().toISOString()
    const golden: GoldenSet = {}
    for (const [key, result] of results) {
      golden[key] = {
        number: 0,
        repositoryId: key.split('#')[0],
        title: '',
        additions: null,
        deletions: null,
        changedFiles: null,
        currentLabel: '',
        goldenLabel: result.label,
        reason: result.reason,
        judgedAt: now,
        judgedModel: resumeModel,
      }
    }

    saveGolden(golden)
    console.log(`\nDone. Saved to golden.json`)
    printGoldenSummary(golden)
    return
  }

  // Normal flow: create new batch job with all PRs
  console.log(`Model: ${model}`)

  const db = new Database(path.join('data', 'tenant_iris.db'), {
    readonly: true,
  })

  const prs = loadPRsFromSamples(files)
  if (prs.length === 0) {
    console.log('No PRs found in sample files.')
    db.close()
    return
  }

  console.log(`\nTotal: ${prs.length} unique PRs to judge`)

  const results = await judgePRsBatch(ai, model, prs, db)
  db.close()

  const golden = buildGoldenFromResults(results, prs, model)
  saveGolden(golden)

  console.log(`\nDone. ${Object.keys(golden).length} entries written.`)
  printGoldenSummary(golden)
}

main()
