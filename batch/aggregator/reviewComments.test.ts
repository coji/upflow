import { test, expect } from 'vitest'
import { reviewComments } from './reviewComments'

describe('reviewComments', () => {
  test('returns flat array of DiffNote or DiscussionNote type items', () => {
    const comments = reviewComments([
      {
        id: 'a',
        individual_note: true,
        notes: [
          { id: 1, type: 'DiffNote', body: '', author: {}, created_at: '', updated_at: '', system: true, noteable_id: 1, noteable_type: '', resolvable: false },
          { id: 2, type: 'other', body: '', author: {}, created_at: '', updated_at: '', system: true, noteable_id: 1, noteable_type: '', resolvable: false },
          { id: 3, type: 'DiffNote', body: '', author: {}, created_at: '', updated_at: '', system: true, noteable_id: 1, noteable_type: '', resolvable: false }
        ]
      },
      {
        id: 'b',
        individual_note: true,
        notes: [
          { id: 4, type: 'DiffNote', body: '', author: {}, created_at: '', updated_at: '', system: true, noteable_id: 1, noteable_type: '', resolvable: false },
          {
            id: 5,
            type: 'DiscussionNote',
            body: '',
            author: {},
            created_at: '',
            updated_at: '',
            system: true,
            noteable_id: 1,
            noteable_type: '',
            resolvable: false
          },
          { id: 6, type: 'DiffNote', body: '', author: {}, created_at: '', updated_at: '', system: true, noteable_id: 1, noteable_type: '', resolvable: false }
        ]
      }
    ])
    expect(comments).toHaveLength(5)
    expect(comments[0].id).toStrictEqual(1)
    expect(comments[1].id).toStrictEqual(3)
    expect(comments[2].id).toStrictEqual(4)
    expect(comments[3].id).toStrictEqual(5)
    expect(comments[4].id).toStrictEqual(6)
  })

  test('returns empty array if specified empty array', () => {
    const comments = reviewComments([])
    expect(comments).toHaveLength(0)
  })
})
