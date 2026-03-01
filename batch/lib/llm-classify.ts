/**
 * LLM-based PR classification using Gemini
 *
 * PRのファイル一覧・差分サイズ・タイトルから「レビュー複雑度」を判定する。
 * lab/lib/llm-classify.ts をバッチパイプライン用に移植。
 *
 * 環境変数: GEMINI_API_KEY (Google AI Studio)
 */

import { GoogleGenAI, Type } from '@google/genai'
import { logger } from '~/batch/helper/logger'

export type ReviewComplexity = 'XS' | 'S' | 'M' | 'L' | 'XL'

export interface LLMClassification {
  complexity: ReviewComplexity
  reason: string
  risk_areas: string[]
}

interface PRInput {
  repositoryId: string
  number: number
  title: string
  author: string | null
  additions: number | null
  deletions: number | null
  changedFiles: number | null
  files: { path: string; additions: number; deletions: number }[]
}

function toResultKey(pr: Pick<PRInput, 'repositoryId' | 'number'>): string {
  return `${pr.repositoryId}#${pr.number}`
}

interface TokenUsage {
  promptTokens: number
  candidatesTokens: number
  totalTokens: number
}

interface ClassifyResult {
  classification: LLMClassification
  usage: TokenUsage
}

const DEFAULT_MODEL = 'gemini-2.5-flash-lite'

const SYSTEM_INSTRUCTION = `Classify PR review complexity based on metadata. Judge by reviewer cognitive load, not code volume.

Classification:
- XS: Typos, formatting, config tweaks, dependency bumps (< 2 min)
- S: Small bug fixes, test additions, doc updates, single-concern changes (< 10 min)
- M: Feature additions, multi-file refactors with clear scope (10-30 min)
- L: Cross-cutting changes, DB migration + API changes, auth/payment logic (30-60 min)
- XL: Architecture changes, large rewrites, multi-system integration (60+ min)

Constraints:
- Ignore lock files and auto-generated code diffs for review load assessment
- Files with auth/token/session in path are low complexity if only config or type definitions
- Test-only changes are S or below regardless of code volume`

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    complexity: {
      type: Type.STRING,
      description: 'Review complexity level',
      enum: ['XS', 'S', 'M', 'L', 'XL'],
    },
    reason: {
      type: Type.STRING,
      description: 'One-sentence justification',
    },
    risk_areas: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Risk areas (e.g. "auth", "DB migration", "payment")',
    },
  },
  required: ['complexity', 'reason', 'risk_areas'],
} as const

async function classifySinglePR(
  ai: GoogleGenAI,
  model: string,
  pr: PRInput,
): Promise<ClassifyResult> {
  const fileList =
    pr.files.length > 0
      ? pr.files
          .map((f) => `  ${f.path} (+${f.additions}/-${f.deletions})`)
          .join('\n')
      : '  (no file list available)'

  const prompt = `PR #${pr.number}: ${pr.title}
Author: ${pr.author ?? 'unknown'}
Total: +${pr.additions ?? 0}/-${pr.deletions ?? 0}, ${pr.changedFiles ?? 0} files

Files:
${fileList}

Classify this PR's review complexity.`

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  const text = response.text
  if (!text) throw new Error('Empty response from Gemini')

  return {
    classification: JSON.parse(text) as LLMClassification,
    usage: {
      promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
    },
  }
}

// Gemini 2.5 Flash Lite pricing (per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash-lite': { input: 0.075, output: 0.3 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
}

function estimateCost(usage: TokenUsage, model: string): number {
  const pricing = PRICING[model] ?? PRICING['gemini-2.5-flash-lite']
  return (
    (usage.promptTokens / 1_000_000) * pricing.input +
    (usage.candidatesTokens / 1_000_000) * pricing.output
  )
}

export interface BatchClassifyResult {
  results: Map<string, LLMClassification>
  totalUsage: TokenUsage
  estimatedCost: number
  successCount: number
  errorCount: number
}

/**
 * Batch classify PRs with concurrency control and cost tracking
 */
export async function batchClassifyPRs(
  prs: PRInput[],
  options?: {
    apiKey?: string
    model?: string
    concurrency?: number
    delayMs?: number
  },
): Promise<BatchClassifyResult> {
  const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is required. Get one at https://aistudio.google.com/apikey',
    )
  }

  const ai = new GoogleGenAI({ apiKey })
  const model = options?.model ?? DEFAULT_MODEL
  const concurrency = options?.concurrency ?? 5
  const delayMs = options?.delayMs ?? 200

  const results = new Map<string, LLMClassification>()
  const totalUsage: TokenUsage = {
    promptTokens: 0,
    candidatesTokens: 0,
    totalTokens: 0,
  }
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < prs.length; i += concurrency) {
    const batch = prs.slice(i, i + concurrency)
    const promises = batch.map(async (pr) => {
      const key = toResultKey(pr)
      try {
        const result = await classifySinglePR(ai, model, pr)
        results.set(key, result.classification)
        totalUsage.promptTokens += result.usage.promptTokens
        totalUsage.candidatesTokens += result.usage.candidatesTokens
        totalUsage.totalTokens += result.usage.totalTokens
        successCount++
      } catch (err) {
        logger.warn(
          `Failed to classify PR #${pr.number}: ${err instanceof Error ? err.message : String(err)}`,
        )
        errorCount++
      }
    })
    await Promise.all(promises)

    logger.info(
      `Classified ${Math.min(i + concurrency, prs.length)}/${prs.length} PRs`,
    )

    if (i + concurrency < prs.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  const cost = estimateCost(totalUsage, model)
  logger.info(
    `Classification complete: ${successCount} success, ${errorCount} errors, cost $${cost.toFixed(4)}`,
  )

  return { results, totalUsage, estimatedCost: cost, successCount, errorCount }
}
