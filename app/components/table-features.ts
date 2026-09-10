import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  type RowData,
} from '@tanstack/react-table'

/**
 * Shared TanStack Table v9 feature set for all app tables.
 * Covers sorting, row selection, column visibility and pagination state
 * with a sorted row model — the union of what AppDataTable and the
 * settings/feedback tables use. Tables only pay for these features; add
 * more per-table if needed.
 *
 * Note: rowPaginationFeature is registered for state shape only (the
 * feedbacks table drives pagination server-side via manualPagination);
 * no paginated row model is registered so getRowModel() stays unpaginated.
 */
export const appTableFeatures = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
})

export type AppTableFeatures = typeof appTableFeatures

export function createAppColumnHelper<TData extends RowData>() {
  return createColumnHelper<AppTableFeatures, TData>()
}
