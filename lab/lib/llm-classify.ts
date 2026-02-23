/**
 * LLM-based PR classification using Gemini
 *
 * PRのファイル一覧・差分サイズ・タイトルから「レビュー複雑度」を判定する。
 * ルールベース(classify.ts)の代替として、コンテキストを理解した分類を行う。
 *
 * 環境変数: GEMINI_API_KEY (Google AI Studio)
 *
 * Gemini 3 prompting guide に準拠:
 * - 簡潔で直接的な指示
 * - temperature はデフォルト(1.0)を維持
 * - 構造: コンテキスト → タスク → 制約
 * @see https://ai.google.dev/gemini-api/docs/gemini-3
 */

import { GoogleGenAI, Type } from '@google/genai'
import type { PRSizeInfo } from './github'

export type ReviewComplexity = 'XS' | 'S' | 'M' | 'L' | 'XL'

export interface LLMClassification {
  complexity: ReviewComplexity
  reason: string
  risk_areas: string[]
  suggested_reviewers: string[]
}

export interface TokenUsage {
  promptTokens: number
  candidatesTokens: number
  totalTokens: number
}

export interface ClassifyResult {
  classification: LLMClassification
  usage: TokenUsage
}

// Gemini 3 guide: concise, direct, context → task → constraints
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
    suggested_reviewers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Suggested reviewer roles (e.g. "backend", "security")',
    },
  },
  required: ['complexity', 'reason', 'risk_areas', 'suggested_reviewers'],
} as const

// Gemini 2.5 Flash Lite pricing (per 1M tokens)
// @see https://ai.google.dev/gemini-api/docs/pricing
const PRICING = {
  'gemini-2.5-flash-lite': { input: 0.075, output: 0.3 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
} as const

export function estimateCost(
  usage: TokenUsage,
  model = 'gemini-2.5-flash-lite',
): number {
  const pricing =
    PRICING[model as keyof typeof PRICING] ?? PRICING['gemini-2.5-flash-lite']
  return (
    (usage.promptTokens / 1_000_000) * pricing.input +
    (usage.candidatesTokens / 1_000_000) * pricing.output
  )
}

export async function classifyWithLLM(
  pr: PRSizeInfo,
  options?: { apiKey?: string; model?: string },
): Promise<ClassifyResult> {
  const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is required. Get one at https://aistudio.google.com/apikey',
    )
  }

  const ai = new GoogleGenAI({ apiKey })
  const model = options?.model ?? 'gemini-2.5-flash-lite'

  const fileList =
    pr.files?.nodes
      ?.map((f) => `  ${f.path} (+${f.additions}/-${f.deletions})`)
      .join('\n') || '  (no file list available)'

  // Gemini 3 guide: context first, question last
  const prompt = `PR #${pr.number}: ${pr.title}
Author: ${pr.author?.login ?? 'unknown'}
Total: +${pr.additions}/-${pr.deletions}, ${pr.changedFiles} files
Labels: ${pr.labels?.nodes?.map((l) => l.name).join(', ') || 'none'}

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
      // Gemini 3 guide: temperature はデフォルト(1.0)を維持。下げるとループや性能劣化の原因になる
      // 分類タスクなので thinking は LOW でレイテンシ削減
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  const text = response.text
  if (!text) throw new Error('Empty response from Gemini')

  const usage: TokenUsage = {
    promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
    candidatesTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
  }

  return {
    classification: JSON.parse(text) as LLMClassification,
    usage,
  }
}

export interface BatchResult {
  classifications: Map<string, LLMClassification>
  totalUsage: TokenUsage
  estimatedCost: number
}

/**
 * Batch classify with rate limiting and cost tracking
 */
export async function batchClassifyWithLLM(
  prs: PRSizeInfo[],
  options?: {
    apiKey?: string
    model?: string
    concurrency?: number
    delayMs?: number
    onProgress?: (done: number, total: number, usage: TokenUsage) => void
  },
): Promise<BatchResult> {
  const classifications = new Map<string, LLMClassification>()
  const concurrency = options?.concurrency ?? 5
  const delayMs = options?.delayMs ?? 200
  const model = options?.model ?? 'gemini-2.5-flash-lite'
  const totalUsage: TokenUsage = {
    promptTokens: 0,
    candidatesTokens: 0,
    totalTokens: 0,
  }

  for (let i = 0; i < prs.length; i += concurrency) {
    const batch = prs.slice(i, i + concurrency)
    const promises = batch.map(async (pr) => {
      const key = `${pr.repo}#${pr.number}`
      try {
        const result = await classifyWithLLM(pr, options)
        classifications.set(key, result.classification)
        totalUsage.promptTokens += result.usage.promptTokens
        totalUsage.candidatesTokens += result.usage.candidatesTokens
        totalUsage.totalTokens += result.usage.totalTokens
      } catch (err) {
        classifications.set(key, {
          complexity: 'M',
          reason: `Error: ${err instanceof Error ? err.message : String(err)}`,
          risk_areas: [],
          suggested_reviewers: [],
        })
      }
    })
    await Promise.all(promises)
    options?.onProgress?.(
      Math.min(i + concurrency, prs.length),
      prs.length,
      totalUsage,
    )

    if (i + concurrency < prs.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return {
    classifications,
    totalUsage,
    estimatedCost: estimateCost(totalUsage, model),
  }
}
