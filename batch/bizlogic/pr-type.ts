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

function isReleaseShapedBranch(normalizedSourceBranch: string): boolean {
  return (
    normalizedSourceBranch.startsWith('release/') ||
    normalizedSourceBranch === 'main' ||
    normalizedSourceBranch === 'master'
  )
}

function hasVersionMismatch(
  trimmedTitle: string,
  trimmedSourceBranch: string,
): boolean {
  const titleVersion = trimmedTitle.match(versionPattern)?.[0]
  if (!titleVersion) return false
  const branchVersion = trimmedSourceBranch.match(versionPattern)?.[0]
  return branchVersion != null && branchVersion !== titleVersion
}

export function classifyPrType(
  input: ClassifyPrTypeInput,
): ClassifyPrTypeResult {
  const trimmedTitle = input.title.trim()
  const trimmedSourceBranch = input.sourceBranch.trim()
  const sourceBranch = trimmedSourceBranch.toLowerCase()
  const targetBranch = normalize(input.targetBranch)
  const author = normalize(input.author)
  const titleHasReleaseMarker = releaseTitlePattern.test(trimmedTitle)

  let prType: PrType
  if (
    sourceBranch.startsWith('release/') ||
    titleHasReleaseMarker ||
    ((sourceBranch === 'main' || sourceBranch === 'master') &&
      (targetBranch === 'production' || targetBranch === 'prod'))
  ) {
    prType = 'release'
  } else if (
    templateMergeTitlePattern.test(trimmedTitle) ||
    sourceBranch.startsWith('template/') ||
    sourceBranch.startsWith('template_update-')
  ) {
    prType = 'template-merge'
  } else if (
    author !== '' &&
    (input.authorIsBot === true || input.botLogins?.has(author) === true)
  ) {
    prType = 'dependency'
  } else {
    prType = 'normal'
  }

  const prTypeWarning: PrTypeWarning | null =
    titleHasReleaseMarker &&
    !isReleaseShapedBranch(sourceBranch) &&
    hasVersionMismatch(trimmedTitle, trimmedSourceBranch)
      ? 'signal-conflict'
      : null

  return { prType, prTypeWarning }
}
