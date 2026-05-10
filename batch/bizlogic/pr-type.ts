export const prTypes = [
  'release',
  'template-merge',
  'dependency',
  'normal',
] as const

export type PrType = (typeof prTypes)[number]
export type PrTypeWarning = 'signal-conflict'

export interface ClassifyPrTypeInput {
  title: string
  sourceBranch: string
  targetBranch: string
  author: string | null
  authorIsBot?: boolean | null
  botLogins?: ReadonlySet<string>
}

export interface ClassifyPrTypeResult {
  prType: PrType
  prTypeWarning: PrTypeWarning | null
}

const releaseTitlePattern =
  /^(Release\b|chore\(release\):|release:|\[release\])/i
const templateMergeTitlePattern = /^Merged .+ into .+/i
const versionPattern = /\b\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function isReleaseSignal(input: ClassifyPrTypeInput) {
  const sourceBranch = normalize(input.sourceBranch)
  const targetBranch = normalize(input.targetBranch)
  return (
    sourceBranch.startsWith('release/') ||
    releaseTitlePattern.test(input.title.trim()) ||
    ((sourceBranch === 'main' || sourceBranch === 'master') &&
      (targetBranch === 'production' || targetBranch === 'prod'))
  )
}

function isTemplateMergeSignal(input: ClassifyPrTypeInput) {
  const sourceBranch = normalize(input.sourceBranch)
  return (
    templateMergeTitlePattern.test(input.title.trim()) ||
    sourceBranch.startsWith('template/') ||
    sourceBranch.startsWith('template_update-')
  )
}

function isDependencySignal(input: ClassifyPrTypeInput) {
  const author = normalize(input.author)
  if (!author) return false
  return input.authorIsBot === true || input.botLogins?.has(author) === true
}

function getReleaseTitleVersion(title: string) {
  if (!releaseTitlePattern.test(title.trim())) return null
  return title.match(versionPattern)?.[0] ?? null
}

function hasSignalConflict(input: ClassifyPrTypeInput) {
  const releaseTitleVersion = getReleaseTitleVersion(input.title)
  if (!releaseTitleVersion) return false

  const sourceBranch = normalize(input.sourceBranch)
  if (
    sourceBranch.startsWith('release/') ||
    sourceBranch === 'main' ||
    sourceBranch === 'master'
  ) {
    return false
  }

  const branchVersion = input.sourceBranch.match(versionPattern)?.[0] ?? null
  return branchVersion !== null && branchVersion !== releaseTitleVersion
}

export function classifyPrType(
  input: ClassifyPrTypeInput,
): ClassifyPrTypeResult {
  const prType: PrType = isReleaseSignal(input)
    ? 'release'
    : isTemplateMergeSignal(input)
      ? 'template-merge'
      : isDependencySignal(input)
        ? 'dependency'
        : 'normal'

  return {
    prType,
    prTypeWarning: hasSignalConflict(input) ? 'signal-conflict' : null,
  }
}
