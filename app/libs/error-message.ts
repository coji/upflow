/**
 * Extract a human-readable message from an unknown caught value.
 * Avoids `String(e)` which produces "[object Error]" for Error instances.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}
