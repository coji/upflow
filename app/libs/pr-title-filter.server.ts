import {
  hasAnyEnabledPrTitleFilter,
  listEnabledPrTitleFilterPatterns,
} from '~/app/services/pr-title-filter-queries.server'
import type { OrganizationId } from '~/app/types/organization'

export interface PrFilterLoaderState {
  showFiltered: boolean
  normalizedPatterns: readonly string[]
  filterActive: boolean
  /**
   * DB に有効パターンが 1 件以上あるか。`showFiltered=1` でも DB 状態は保持するため、
   * バナー状態 UI が「showFiltered を解除しても意味がないケース (0 件)」を判別できる。
   */
  hasAnyEnabledPattern: boolean
}

/**
 * Resolves `?showFiltered=1` URL param against enabled DB patterns.
 * `showFiltered=1` では patterns 本体は matching に使わないので、
 * 軽量な存在チェックだけ実施して DB 往復を減らす。
 */
export const loadPrFilterState = async (
  request: Request,
  organizationId: OrganizationId,
): Promise<PrFilterLoaderState> => {
  const showFiltered =
    new URL(request.url).searchParams.get('showFiltered') === '1'
  if (showFiltered) {
    const hasAnyEnabledPattern =
      await hasAnyEnabledPrTitleFilter(organizationId)
    return {
      showFiltered: true,
      normalizedPatterns: [],
      filterActive: false,
      hasAnyEnabledPattern,
    }
  }
  const enabled = await listEnabledPrTitleFilterPatterns(organizationId)
  return {
    showFiltered: false,
    normalizedPatterns: enabled,
    filterActive: enabled.length > 0,
    hasAnyEnabledPattern: enabled.length > 0,
  }
}

export interface FilterCountStats {
  /** フィルタ無視の総件数 */
  unfiltered: number
  /** フィルタ適用後に残る件数 */
  filtered: number
}

/**
 * Computes the excluded-count banner value. `counter` は SUM(CASE WHEN ...)
 * 併用で unfiltered と filtered の両方を 1 クエリで返すこと。Skips when filter
 * isn't active.
 */
export const computeExcludedCount = async (
  state: PrFilterLoaderState,
  counter: (patterns: readonly string[]) => Promise<FilterCountStats>,
): Promise<number> => {
  if (!state.filterActive) return 0
  const { unfiltered, filtered } = await counter(state.normalizedPatterns)
  return unfiltered - filtered
}
