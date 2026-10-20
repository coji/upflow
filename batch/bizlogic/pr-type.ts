import type { PrType, PrTypeWarning } from '~/app/libs/pr-type'

/**
 * PR 種別の規則ベース判定 (docs/rdd/issue-429-pr-type-classification.md)。
 *
 * 優先度: release > template-merge > dependency > normal。
 * 各種別の title / branch シグナルは OR で評価し、最初に該当した種別を採る。
 * release-please のように release を作る bot がいるので、author の bot 判定は
 * title / branch シグナルより後に見る。
 *
 * dependency は「bot author かつ依存更新のシグナルがある」PR。AI コーディング
 * エージェントや CI 自動化も bot として PR を作るが、依存更新ではないので
 * normal に残す (bot author の除外は従来どおり excludeBots が担う)。
 */

// release の直後にバージョンが続くものだけを見る。"fix: release branch detection"
// や "release.sh ..." のように release に触れるだけの PR を拾わないため。
const RELEASE_TITLE = [
  // "Release v1.2", "[web] Release 1.2.0", "release: 1.2.0"
  /^(\[[^\]]*\]\s*)*release[\s:]+v?\d/i,
  // "chore(main): release 1.2.0" (release-please)
  /^chore(\([^)]*\))?!?:\s*release\s+v?\d/i,
  // "Mobile release 2.3.1", "Release app-1.2.4"
  /\brelease\s+([a-z]+[- ]?)?v?\d+\.\d+/i,
]
const RELEASE_BRANCH = /^(release\/|release-please--)/i
const DEPLOY_SOURCE_BRANCHES = new Set(['main', 'master'])
const DEPLOY_TARGET_BRANCHES = new Set(['production', 'prod'])

const TEMPLATE_MERGE_TITLE = /^merged .+ into /i
const TEMPLATE_BRANCH = /^(template\/|template_update-)/i

const DEPENDENCY_BRANCH = /(^|[/-])(renovate|dependabot)([/-]|$)/i
const DEPENDENCY_TITLE =
  /(^\w+\(deps(-dev)?\)!?:|^bump\s|\bdependenc(y|ies)\b|^update\s+\S+\s+to\s)/i

/** 通常の作業ブランチの命名。title シグナルと食い違えば規約外命名とみなす */
const WORK_BRANCH = /^(feature|feat|fix|bugfix|hotfix|issue|topic)\//i

export interface PrTypeInput {
  title: string
  sourceBranch: string
  targetBranch: string
  authorIsBot: boolean
}

export interface PrTypeResult {
  prType: PrType
  prTypeWarning: PrTypeWarning | null
}

export function classifyPrType(input: PrTypeInput): PrTypeResult {
  const title = input.title.trim()
  const source = input.sourceBranch.trim()
  const target = input.targetBranch.trim()

  const releaseByTitle = RELEASE_TITLE.some((re) => re.test(title))
  const releaseByBranch =
    RELEASE_BRANCH.test(source) ||
    (DEPLOY_SOURCE_BRANCHES.has(source.toLowerCase()) &&
      DEPLOY_TARGET_BRANCHES.has(target.toLowerCase()))
  const templateByTitle = TEMPLATE_MERGE_TITLE.test(title)
  const templateByBranch = TEMPLATE_BRANCH.test(source)

  const isRelease = releaseByTitle || releaseByBranch
  const isTemplate = templateByTitle || templateByBranch

  const conflict =
    // 異なる種別のシグナルが同時に出ている
    (isRelease && isTemplate) ||
    // title は release / template を示すのに、branch は通常の作業ブランチ
    ((releaseByTitle || templateByTitle) &&
      !releaseByBranch &&
      !templateByBranch &&
      WORK_BRANCH.test(source))
  const prTypeWarning: PrTypeWarning | null = conflict
    ? 'signal-conflict'
    : null

  if (isRelease) return { prType: 'release', prTypeWarning }
  if (isTemplate) return { prType: 'template-merge', prTypeWarning }
  if (
    input.authorIsBot &&
    (DEPENDENCY_BRANCH.test(source) || DEPENDENCY_TITLE.test(title))
  ) {
    return { prType: 'dependency', prTypeWarning }
  }
  return { prType: 'normal', prTypeWarning }
}
