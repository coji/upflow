import { describe, expect, test } from 'vitest'
import { reorderRows } from './AppDataTable'

const row = (id: string) => ({ id }) as { id: string }

describe('reorderRows', () => {
  test('preserves snapshot order when data changes', () => {
    const snapshot = ['a', 'b', 'c']
    const rows = [row('c'), row('a'), row('b')]
    const result = reorderRows(rows, snapshot)
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  test('appends new rows at the end', () => {
    const snapshot = ['a', 'b']
    const rows = [row('a'), row('b'), row('new')]
    const result = reorderRows(rows, snapshot)
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'new'])
  })

  test('handles removed rows gracefully', () => {
    const snapshot = ['a', 'b', 'c']
    const rows = [row('c'), row('a')]
    const result = reorderRows(rows, snapshot)
    expect(result.map((r) => r.id)).toEqual(['a', 'c'])
  })

  test('handles empty snapshot (no sort applied)', () => {
    const snapshot: string[] = []
    const rows = [row('a'), row('b')]
    const result = reorderRows(rows, snapshot)
    expect(result.map((r) => r.id)).toEqual(['a', 'b'])
  })

  test('handles empty rows', () => {
    const snapshot = ['a', 'b']
    const result = reorderRows([], snapshot)
    expect(result).toEqual([])
  })
})
