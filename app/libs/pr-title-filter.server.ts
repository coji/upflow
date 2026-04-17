import { listEnabledPrTitleFilterPatterns } from '~/app/services/pr-title-filter-queries.server'
import type { OrganizationId } from '~/app/types/organization'

export interface PrFilterLoaderState {
  showFiltered: boolean
  normalizedPatterns: readonly string[]
  filterActive: boolean
}

/**
 * Resolves `?showFiltered=1` URL param against enabled DB patterns.
 * `showFiltered=1` bypasses the filter (returns empty patterns) so the
 * "Show all" toggle reveals the underlying dataset without touching the DB.
 */
export const loadPrFilterState = async (
  request: Request,
  organizationId: OrganizationId,
): Promise<PrFilterLoaderState> => {
  const showFiltered =
    new URL(request.url).searchParams.get('showFiltered') === '1'
  const normalizedPatterns = showFiltered
    ? []
    : await listEnabledPrTitleFilterPatterns(organizationId)
  return {
    showFiltered,
    normalizedPatterns,
    filterActive: !showFiltered && normalizedPatterns.length > 0,
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
