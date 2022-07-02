import { Types } from '@gitbeaker/node'

export const firstCommit = (commits: Types.CommitSchema[]) =>
  commits.length
    ? commits.reduce((a, b) => (a.created_at < b.created_at ? a : b)) // 一番過去のもの1件を抽出
    : null

// test
if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest
  test('returns a last created item', () => {
    const commit = firstCommit([
      { id: 'a', short_id: '', title: '', message: '', author_email: '', author_name: '', web_url: '', created_at: new Date('2022-01-03 10:00:00') },
      { id: 'b', short_id: '', title: '', message: '', author_email: '', author_name: '', web_url: '', created_at: new Date('2022-01-02 10:00:00') },
      { id: 'c', short_id: '', title: '', message: '', author_email: '', author_name: '', web_url: '', created_at: new Date('2022-01-01 10:00:00') }
    ])
    expect(commit).toBeTypeOf('object')
    expect(commit?.id).toStrictEqual('c')
  })

  test('returns null if specified empty items', () => {
    const commit = firstCommit([])
    expect(commit).toBeNull()
  })
}
