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

/**
 * Computes the excluded-count banner value by running `counter` twice
 * (unfiltered vs filtered) in parallel. Skips when filter isn't active.
 */
export const computeExcludedCount = async (
  state: PrFilterLoaderState,
  counter: (patterns: readonly string[]) => Promise<number>,
): Promise<number> => {
  if (!state.filterActive) return 0
  const [unfiltered, filtered] = await Promise.all([
    counter([]),
    counter(state.normalizedPatterns),
  ])
  return unfiltered - filtered
}
