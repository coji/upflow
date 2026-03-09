/**
 * Escape special characters in a string for use in SQL LIKE patterns.
 * Prevents LIKE injection where user input containing % or _ could
 * manipulate search results.
 */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&')
}

/**
 * Calculate pagination metadata from total count.
 */
export function calcPagination(
  totalItems: number,
  currentPage: number,
  pageSize: number,
) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  return {
    currentPage: Math.min(currentPage, totalPages),
    pageSize,
    totalPages,
    totalItems,
  }
}
