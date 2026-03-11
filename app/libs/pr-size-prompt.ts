/**
 * PR サイズ分類の共有プロンプト定義
 *
 * 分類プロンプト (batch/lib/llm-classify.ts) と
 * フィードバックドラフトプロンプト (app/routes/$orgSlug/draft-feedback-reason.ts)
 * の両方で使う Single Source of Truth。
 *
 * docs/pr-size-feedback-loop.md「PR サイズ定義」セクションに対応。
 */

/** サイズ定義（レベルごとの認知負荷と典型例） */
export const SIZE_DEFINITIONS = `Classification is based on reviewer cognitive load and impact scope — NOT diff line count.

XS — Near-zero cognitive load. Mechanical, localized. No need to understand intent.
  Examples: typo fixes, config value changes, lock file updates, version bumps, dependency updates, bot-generated releases, pure file moves/renames, removing unused code in bulk, revert PRs, release/merge PRs (pre-reviewed code being merged between branches).

S — Low cognitive load. Single concern, straightforward to verify.
  Examples: small bug fixes, adding a test for existing behavior, doc/README updates, feature flag toggles, minor dependency updates requiring small code adjustments.

M — Moderate cognitive load. One component's context needed. Change boundaries are clear.
  Examples: scoped new feature (1 endpoint, 1 component), module-internal refactor, multi-file changes with a single purpose.

L — High cognitive load. Multiple components OR risky area (DB schema, auth, payment, security).
  Examples: cross-cutting changes (DB + API + UI), auth/payment/security logic, new subsystem, changes requiring understanding of dependencies between multiple modules.

XL — Very high cognitive load. System-level understanding required.
  Examples: architecture overhauls, framework migrations, major rewrites.`

/** 判定フロー（ステップバイステップ） */
export const DECISION_PROCEDURE = `Step 1: Is the change MECHANICAL? (version bump, rename, revert, release, merge between branches, lock file updates, codegen)
  → Yes: classify as XS (no intent to read) or S (minimal intent to verify).

Step 2: Does the change touch a RISKY AREA? (DB schema/migration, auth, payment/billing, security, external API integration)
  → Yes: classify as at least L, regardless of diff size. Even 10 lines of auth logic require high cognitive load.

Step 3: How many COMPONENTS does the change span?
  → Single concern within one module → S
  → One component with clear boundaries → M
  → Multiple components or cross-cutting (e.g. DB + API + UI) → L
  → System-wide, architecture-level → XL

Step 4: Use diff volume only as a TIEBREAKER when cognitive load is ambiguous between adjacent levels.

Step 5: Verify — would the adjacent level (one above or below) be more accurate? Prefer the level that better reflects the reviewer's actual cognitive effort.`

/** リスク領域の閉じたリスト */
export const RISK_AREA_VALUES = [
  'auth',
  'DB schema/migration',
  'payment/billing',
  'security',
  'external API',
] as const

export type RiskArea = (typeof RISK_AREA_VALUES)[number]
