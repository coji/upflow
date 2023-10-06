import { describe, expect, test } from 'vitest'
import { firstCommit } from './firstCommit'

describe('firstCommit', () => {
  // test
  test('returns a last created item', () => {
    const commit = firstCommit([
      {
        sha: 'a',
        committer: '',
        url: '',
        createdAt: '2022-01-03 10:00:00',
      },
      {
        sha: 'b',
        committer: '',
        url: '',
        createdAt: '2022-01-02 10:00:00',
      },
      {
        sha: 'c',
        committer: '',
        url: '',
        createdAt: '2022-01-01 10:00:00',
      },
    ])
    expect(commit).toBeTypeOf('object')
    expect(commit?.sha).toStrictEqual('c')
  })

  test('returns null if specified empty items', () => {
    const commit = firstCommit([])
    expect(commit).toBeNull()
  })
})
