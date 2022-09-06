import { expect, test } from 'vitest'
import { reviewComments } from './reviewComments'

describe('reviewComments', () => {
  test('returns flat array of DiffNote or DiscussionNote type items', () => {
    const comments = reviewComments([
      {
        notes: [
          {
            id: 1,
            type: 'DiffNote',
            author: '',
            createdAt: ''
          },
          {
            id: 2,
            type: 'other',
            author: '',
            createdAt: ''
          },
          {
            id: 3,
            type: 'DiffNote',
            author: '',
            createdAt: ''
          }
        ]
      },
      {
        notes: [
          {
            id: 4,
            type: 'DiffNote',
            author: '',
            createdAt: ''
          },
          {
            id: 5,
            type: 'DiscussionNote',
            author: '',
            createdAt: ''
          },
          {
            id: 6,
            type: 'DiffNote',
            author: '',
            createdAt: ''
          }
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
