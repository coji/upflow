import type { PrFilterPattern } from '~/app/libs/pr-title-filter'
import {
  hasAnyEnabledPrTitleFilter,
  listEnabledPrTitleFilterPatterns,
} from '~/app/services/pr-title-filter-queries.server'
import type { OrganizationId } from '~/app/types/organization'
import type { PrType } from './pr-type'
import { parseIncludedPrTypes, toAllowedPrTypes } from './pr-type-filter'

export interface PrFilterLoaderState {
  showFiltered: boolean
  normalizedPatterns: readonly PrFilterPattern[]
  filterActive: boolean
  /**
   * DB に有効パターンが 1 件以上あるか。`showFiltered=1` でも DB 状態は保持するため、
   * バナー状態 UI が「showFiltered を解除しても意味がないケース (0 件)」を判別できる。
   */
  hasAnyEnabledPattern: boolean
  /** 集計に含める PR 種別 (`?prTypes=`、#429)。normal は常に含む */
  prTypes: readonly PrType[]
}

/**
 * Resolves `?showFiltered=1` URL param against enabled DB patterns.
 * `showFiltered=1` では patterns 本体は matching に使わないので、
 * 軽量な存在チェックだけ実施して DB 往復を減らす。
 */
export const loadPrFilterState = async (
  url: URL,
  organizationId: OrganizationId,
): Promise<PrFilterLoaderState> => {
  const showFiltered = url.searchParams.get('showFiltered') === '1'
  const prTypes = toAllowedPrTypes(parseIncludedPrTypes(url.searchParams))
  if (showFiltered) {
    const hasAnyEnabledPattern =
      await hasAnyEnabledPrTitleFilter(organizationId)
    return {
      showFiltered: true,
      normalizedPatterns: [],
      filterActive: false,
      hasAnyEnabledPattern,
      prTypes,
    }
  }
  const enabled = await listEnabledPrTitleFilterPatterns(organizationId)
  return {
    showFiltered: false,
    normalizedPatterns: enabled,
    filterActive: enabled.length > 0,
    hasAnyEnabledPattern: enabled.length > 0,
    prTypes,
  }
}

export interface FilterCountStats {
  /** フィルタ無視の総件数 */
  unfiltered: number
  /** フィルタ適用後に残る件数 */
  filtered: number
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

/**
 * Computes the excluded-count banner value. `counter` は SUM(CASE WHEN ...)
 * 併用で unfiltered と filtered の両方を 1 クエリで返すこと。Skips when filter
 * isn't active.
 */
export const computeExcludedCount = async (
  state: PrFilterLoaderState,
  counter: (patterns: readonly PrFilterPattern[]) => Promise<FilterCountStats>,
): Promise<number> => {
  if (!state.filterActive) return 0
  const { unfiltered, filtered } = await counter(state.normalizedPatterns)
  return unfiltered - filtered
}
