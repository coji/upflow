import { AppError } from './app-error'

/**
 * Extract a user-safe message from an unknown caught value.
 * Only AppError messages are passed through; system errors get a generic message.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message
  return 'An unexpected error occurred'
}

/**
 * Extract the full error message for server-side logging.
 * Avoids `String(e)` which produces "[object Error]" for Error instances.
 */
export function getErrorMessageForLog(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}
