import { describe, expect, test } from 'vitest'
import { AppError } from './app-error'
import { getErrorMessage, getErrorMessageForLog } from './error-message'

describe('getErrorMessage', () => {
  test('returns AppError message as-is', () => {
    expect(getErrorMessage(new AppError('Cannot delete yourself'))).toBe(
      'Cannot delete yourself',
    )
  })

  test('returns generic message for plain Error', () => {
    expect(getErrorMessage(new Error('SQLITE_CONSTRAINT: UNIQUE'))).toBe(
      'An unexpected error occurred',
    )
  })

  test('returns generic message for string error', () => {
    expect(getErrorMessage('some string error')).toBe(
      'An unexpected error occurred',
    )
  })

  test('returns generic message for unknown value', () => {
    expect(getErrorMessage(42)).toBe('An unexpected error occurred')
    expect(getErrorMessage(null)).toBe('An unexpected error occurred')
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred')
  })
})

describe('getErrorMessageForLog', () => {
  test('returns Error message', () => {
    expect(getErrorMessageForLog(new Error('DB connection failed'))).toBe(
      'DB connection failed',
    )
  })

  test('returns AppError message', () => {
    expect(getErrorMessageForLog(new AppError('Business error'))).toBe(
      'Business error',
    )
  })

  test('returns string as-is', () => {
    expect(getErrorMessageForLog('raw string')).toBe('raw string')
  })

  test('returns fallback for unknown value', () => {
    expect(getErrorMessageForLog(42)).toBe('Unknown error')
    expect(getErrorMessageForLog(null)).toBe('Unknown error')
    expect(getErrorMessageForLog(undefined)).toBe('Unknown error')
  })
})
