import { describe, expect, test } from 'vitest'
import type { ShapedTimelineItem } from './model'

// buildRequestedAtMap は純粋関数なので直接 import してテスト
const { buildRequestedAtMap } = await import('./fetcher')

describe('buildRequestedAtMap', () => {
  test('returns empty map for empty items', () => {
    const result = buildRequestedAtMap([])
    expect(result.size).toBe(0)
  })

  test('extracts reviewer from ReviewRequestedEvent', () => {
    const items: ShapedTimelineItem[] = [
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T10:00:00Z',
        reviewer: 'alice',
      },
    ]
    const result = buildRequestedAtMap(items)
    expect(result.get('alice')).toBe('2024-01-01T10:00:00Z')
  })

  test('keeps the latest createdAt for the same reviewer', () => {
    const items: ShapedTimelineItem[] = [
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T10:00:00Z',
        reviewer: 'alice',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-02T10:00:00Z',
        reviewer: 'alice',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T12:00:00Z',
        reviewer: 'alice',
      },
    ]
    const result = buildRequestedAtMap(items)
    expect(result.get('alice')).toBe('2024-01-02T10:00:00Z')
  })

  test('ignores non-ReviewRequestedEvent items', () => {
    const items: ShapedTimelineItem[] = [
      {
        type: 'ReadyForReviewEvent',
        createdAt: '2024-01-01T10:00:00Z',
        actor: 'bob',
      },
      {
        type: 'MergedEvent',
        createdAt: '2024-01-02T10:00:00Z',
        actor: 'bob',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T10:00:00Z',
        reviewer: 'alice',
      },
    ]
    const result = buildRequestedAtMap(items)
    expect(result.size).toBe(1)
    expect(result.get('alice')).toBe('2024-01-01T10:00:00Z')
  })

  test('ignores ReviewRequestedEvent without reviewer', () => {
    const items: ShapedTimelineItem[] = [
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T10:00:00Z',
        reviewer: null,
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T10:00:00Z',
      },
    ]
    const result = buildRequestedAtMap(items)
    expect(result.size).toBe(0)
  })

  test('handles multiple reviewers independently', () => {
    const items: ShapedTimelineItem[] = [
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T10:00:00Z',
        reviewer: 'alice',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-02T10:00:00Z',
        reviewer: 'bob',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-03T10:00:00Z',
        reviewer: 'alice',
      },
    ]
    const result = buildRequestedAtMap(items)
    expect(result.get('alice')).toBe('2024-01-03T10:00:00Z')
    expect(result.get('bob')).toBe('2024-01-02T10:00:00Z')
  })
})
