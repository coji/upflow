/**
 * PR 種別 (#429)。cycle time を「人間の作業時間」として測れるのは normal だけで、
 * それ以外はダッシュボードの既定集計から外す。
 */
export const PR_TYPES = [
  'normal',
  'release',
  'template-merge',
  'dependency',
] as const

export type PrType = (typeof PR_TYPES)[number]

/** normal 以外の、ユーザーが個別に集計へ含められる種別 */
export const OPTIONAL_PR_TYPES = [
  'release',
  'template-merge',
  'dependency',
] as const satisfies readonly PrType[]

export type OptionalPrType = (typeof OPTIONAL_PR_TYPES)[number]

export type PrTypeWarning = 'signal-conflict'

export const PR_TYPE_LABELS: Record<PrType, string> = {
  normal: 'Normal',
  release: 'Release',
  'template-merge': 'Template merge',
  dependency: 'Dependency',
}
