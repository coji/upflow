import type {
  HiddenPrBreakdownInput,
  HiddenPrBreakdownRow,
} from '~/app/libs/tenant-query.server'
import { listEnabledPrTitleFilterPatterns } from '~/app/services/pr-title-filter-queries.server'
import type { OrganizationId } from '~/app/types/organization'
import {
  HIDDEN_PR_REASONS,
  type HiddenPrReason,
  type HiddenPrSummary,
} from './hidden-prs'
import type { PrFilterPattern } from './pr-title-filter'
import type { PrType } from './pr-type'
import { parseIncludedPrTypes, toAllowedPrTypes } from './pr-type-filter'

export interface PrFilterLoaderState {
  showFiltered: boolean
  /** query の絞り込みに使うパターン。`showFiltered=1` なら空 */
  normalizedPatterns: readonly PrFilterPattern[]
  /** 登録済みの有効パターン。`showFiltered=1` でも非表示件数の表示に使う */
  enabledPatterns: readonly PrFilterPattern[]
  /** パターンで実際に絞り込んでいるか */
  filterActive: boolean
  /** 集計に含める PR 種別 (`?prTypes=`、#429)。normal は常に含む */
  prTypes: readonly PrType[]
}

/**
 * Resolves `?showFiltered=1` URL param against enabled DB patterns.
 * `showFiltered=1` でも有効パターンは読む (非表示メニューで件数を出すため)。
 */
export const loadPrFilterState = async (
  url: URL,
  organizationId: OrganizationId,
): Promise<PrFilterLoaderState> => {
  const showFiltered = url.searchParams.get('showFiltered') === '1'
  const prTypes = toAllowedPrTypes(parseIncludedPrTypes(url.searchParams))
  const enabled = await listEnabledPrTitleFilterPatterns(organizationId)
  return {
    showFiltered,
    normalizedPatterns: showFiltered ? [] : enabled,
    enabledPatterns: enabled,
    filterActive: !showFiltered && enabled.length > 0,
    prTypes,
  }
}

/**
 * Cache-key suffix for loaders that gate output on PR-title-filter state.
 * Compose as `` `${routePrefix}:...:${filterCacheKeySuffix(filter)}` ``.
 * `JSON.stringify` on the sorted pattern list prevents collisions when a
 * pattern legitimately contains the cache-key separator character.
 */
export const filterCacheKeySuffix = (state: PrFilterLoaderState): string => {
  const sf = state.showFiltered ? 't' : 'f'
  const patternSignature = JSON.stringify(
    state.normalizedPatterns.map((p) => `${p.target}:${p.pattern}`).sort(),
  )
  const prTypes = [...state.prTypes].sort().join(',')
  return `sf=${sf}:patterns=${patternSignature}:types=${prTypes}`
}

export interface HiddenPrSummaryOptions {
  /** その画面が PR 種別フィルタを使うか (既定 true) */
  typesApplicable?: boolean
  /** Draft を隠しているか。undefined はその画面に Draft の切り替えがない */
  hideDrafts?: boolean
}

export const toHiddenPrBreakdownInput = (
  state: PrFilterLoaderState,
  options: HiddenPrSummaryOptions = {},
): HiddenPrBreakdownInput => ({
  prTypes: state.prTypes,
  typesApplicable: options.typesApplicable ?? true,
  enabledPatterns: state.enabledPatterns,
  filterActive: state.filterActive,
  hideDrafts: options.hideDrafts,
})

const ROW_KEYS: Record<HiddenPrReason, keyof HiddenPrBreakdownRow> = {
  release: 'hiddenRelease',
  'template-merge': 'hiddenTemplateMerge',
  dependency: 'hiddenDependency',
  draft: 'hiddenDraft',
  filter: 'hiddenFilter',
}

/**
 * 画面に出さない理由の行。種別を使わない画面の種別行、Draft の切り替えがない画面の
 * Draft 行、パターン未登録のフィルタ行は出さない。
 */
const isApplicable = (
  reason: HiddenPrReason,
  input: HiddenPrBreakdownInput,
): boolean => {
  if (reason === 'draft') return input.hideDrafts !== undefined
  if (reason === 'filter') return input.enabledPatterns.length > 0
  return input.typesApplicable
}

const isActive = (
  reason: HiddenPrReason,
  input: HiddenPrBreakdownInput,
): boolean => {
  if (reason === 'draft') return input.hideDrafts === true
  if (reason === 'filter') return input.filterActive
  return !input.prTypes.includes(reason)
}

export const toHiddenPrSummary = (
  row: HiddenPrBreakdownRow,
  input: HiddenPrBreakdownInput,
): HiddenPrSummary => {
  const reasons = HIDDEN_PR_REASONS.filter((r) => isApplicable(r, input)).map(
    (reason) => ({
      reason,
      active: isActive(reason, input),
      count: Number(row[ROW_KEYS[reason]]),
    }),
  )
  return {
    reasons,
    hiddenCount: reasons
      .filter((r) => r.active)
      .reduce((sum, r) => sum + r.count, 0),
  }
}

/**
 * 非表示メニュー用の件数を数える。`counter` は `hiddenPrBreakdown(input)` を
 * select に並べ、画面の母集団 (種別・Draft・パターンでは絞らない) を 1 回 scan すること。
 */
export const loadHiddenPrSummary = async (
  state: PrFilterLoaderState,
  counter: (input: HiddenPrBreakdownInput) => Promise<HiddenPrBreakdownRow>,
  options: HiddenPrSummaryOptions = {},
): Promise<HiddenPrSummary> => {
  const input = toHiddenPrBreakdownInput(state, options)
  return toHiddenPrSummary(await counter(input), input)
}
