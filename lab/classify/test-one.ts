/**
 * 1件だけ分類してみるテストスクリプト
 *
 * Usage: source .env && pnpm tsx lab/classify/test-one.ts
 */
import { GoogleGenAI, Type } from '@google/genai'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('GEMINI_API_KEY required')
  process.exit(1)
}

const ai = new GoogleGenAI({ apiKey })
const MODEL = 'gemini-3.1-pro-preview'

// Gemini 3 prompting guide に準拠:
// 1. コンテキストを先に
// 2. タスクを次に
// 3. 制約を最後に
// 4. 広すぎる否定指示を避ける
// 5. 情報ソースを明示
const SYSTEM_INSTRUCTION = `You are an expert code reviewer creating ground-truth labels for a PR complexity classifier. Your labels will be used to evaluate and improve an automated classifier, so accuracy and consistency are critical.

# Context

You will receive pull request metadata: title, author, diff statistics (additions/deletions/file count), and optionally a list of changed files. Base your classification ONLY on the provided information.

# Task

Classify each PR into exactly one review complexity level based on the reviewer's cognitive load — the mental effort required to thoroughly review the change.

# Classification levels

XS — Near-zero cognitive load. A reviewer rubber-stamps it.
Typical examples: typos, formatting fixes, config value changes, version bumps, dependency updates (even if the diff is large due to lock files or repetitive edits), bot-generated releases with trivial content, pure file moves/renames, removing unused code in bulk, revert PRs (mechanical undo).

S — Low cognitive load. Single concern, straightforward to verify.
Typical examples: small bug fixes, adding a test for existing behavior, doc/README updates, simple feature flag toggles, minor dependency updates requiring small code adjustments.

M — Moderate cognitive load. Requires understanding one component's context.
Typical examples: new feature with clear scope (one endpoint, one component), focused refactor within a module, multi-file changes with a single purpose. Roughly 100-500 meaningful lines across 5-20 files.

L — High cognitive load. Spans multiple components or touches risky areas.
Typical examples: cross-cutting refactors, DB schema + API + UI changes together, auth/payment/security logic, new subsystem. Roughly 500-1500 meaningful lines across 20-50 files.

XL — Very high cognitive load. Requires system-level understanding.
Typical examples: architecture overhauls, framework migrations, large releases bundling many independent features, major rewrites. Typically 1500+ meaningful lines across 50+ files.

# Decision procedure

Step 1: Identify the NATURE of the change from the title and file paths. Is it mechanical (version bump, rename, revert) or does it require understanding logic?
Step 2: For mechanical changes, classify as XS or S regardless of diff volume.
Step 3: For logic changes, assess how many distinct concerns are involved and how much system context a reviewer needs.
Step 4: Use diff volume as a tiebreaker when cognitive load is ambiguous.
Step 5: For release/merge PRs, consider the VARIETY of bundled changes, not just total lines.

# Volume discounting

These file types inflate diff size without adding review burden: lock files (package-lock.json, yarn.lock, Gemfile.lock, pnpm-lock.yaml), auto-generated code (DBFlute output, codegen, snapshots), and vendored dependencies.`

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
  },
  required: ['complexity', 'reason'],
} as const

// テスト用 PR — 複数件
const testPRs = [
  {
    number: 104,
    title: 'Release 0.0.5',
    author: 'iris-tech-bot',
    additions: 20603,
    deletions: 74,
    changedFiles: 371,
    currentLabel: 'XS',
  },
  {
    number: 995,
    title: 'feat:重複端末削除 dev環境バックアップ',
    author: 'someone',
    additions: 19976,
    deletions: 0,
    changedFiles: 5,
    currentLabel: 'XS',
  },
  {
    number: 153,
    title: 'Release 1.0.18',
    author: 'iris-tech-bot',
    additions: 4957,
    deletions: 2140,
    changedFiles: 422,
    currentLabel: 'XS',
  },
  {
    number: 496,
    title: 'updated: ruby 2.7.5 にアップデート',
    author: 'someone',
    additions: 496,
    deletions: 496,
    changedFiles: 11,
    currentLabel: 'XS',
  },
  {
    number: 475,
    title: 'rubyのバージョンを2.6.7にあげる',
    author: 'someone',
    additions: 475,
    deletions: 469,
    changedFiles: 20,
    currentLabel: 'XS',
  },
]

async function main() {
  for (const pr of testPRs) {
    const prompt = `PR #${pr.number}: ${pr.title}
Author: ${pr.author}
Total: +${pr.additions}/-${pr.deletions}, ${pr.changedFiles} files

Files: (no file list available)

Classify this PR's review complexity.`

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 1024 },
      },
    })

    const text = response.text
    if (text) {
      const result = JSON.parse(text)
      const match = result.complexity === pr.currentLabel ? '✓' : '✗'
      console.log(
        `${match} #${pr.number} current=${pr.currentLabel} predicted=${result.complexity} | +${pr.additions}/-${pr.deletions} ${pr.changedFiles}f | ${pr.title}`,
      )
      console.log(`  → ${result.reason}`)
    }

    await new Promise((r) => setTimeout(r, 500))
  }
}

main().catch(console.error)
