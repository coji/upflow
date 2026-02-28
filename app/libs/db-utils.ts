/**
 * Escape special characters in a string for use in SQL LIKE patterns.
 * Prevents LIKE injection where user input containing % or _ could
 * manipulate search results.
 */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&')
}
