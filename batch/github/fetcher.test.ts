import type { Octokit } from 'octokit'
import { describe, expect, test, vi } from 'vitest'
import type { ShapedTimelineItem } from './model'

// 純粋関数なので直接 import してテスト
const { buildRequestedAtMap, createFetcher, paginateGraphQL, shapeTagNode } =
  await import('./fetcher')

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
        reviewerType: 'User',
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
        reviewerType: 'User',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-02T10:00:00Z',
        reviewer: 'alice',
        reviewerType: 'User',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T12:00:00Z',
        reviewer: 'alice',
        reviewerType: 'User',
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
        reviewerType: 'User',
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
        reviewerType: 'User',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T10:00:00Z',
        reviewerType: 'User',
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
        reviewerType: 'User',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-02T10:00:00Z',
        reviewer: 'bob',
        reviewerType: 'User',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-03T10:00:00Z',
        reviewer: 'alice',
        reviewerType: 'User',
      },
    ]
    const result = buildRequestedAtMap(items)
    expect(result.get('alice')).toBe('2024-01-03T10:00:00Z')
    expect(result.get('bob')).toBe('2024-01-02T10:00:00Z')
  })
})

describe('createFetcher.timelineItems', () => {
  test('keeps reviewerType in shaped timeline items', async () => {
    const graphql = vi.fn(async () => ({
      repository: {
        pullRequest: {
          timelineItems: {
            nodes: [
              {
                __typename: 'ReviewRequestedEvent',
                createdAt: '2024-01-01T10:00:00Z',
                requestedReviewer: {
                  __typename: 'Bot',
                  login: 'renovate',
                },
              },
              {
                __typename: 'ReviewRequestedEvent',
                createdAt: '2024-01-01T11:00:00Z',
                requestedReviewer: {
                  __typename: 'User',
                  login: 'alice',
                },
              },
              {
                __typename: 'ReviewRequestedEvent',
                createdAt: '2024-01-01T12:00:00Z',
                requestedReviewer: {
                  __typename: 'Mannequin',
                  login: 'ghost-user',
                },
              },
            ],
          },
        },
      },
    }))
    const fetcher = createFetcher({
      owner: 'test-owner',
      repo: 'test-repo',
      octokit: { graphql } as unknown as Octokit,
    })

    await expect(fetcher.timelineItems(1)).resolves.toEqual([
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T10:00:00Z',
        reviewer: 'renovate',
        reviewerType: 'Bot',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T11:00:00Z',
        reviewer: 'alice',
        reviewerType: 'User',
      },
      {
        type: 'ReviewRequestedEvent',
        createdAt: '2024-01-01T12:00:00Z',
        reviewer: 'ghost-user',
        reviewerType: 'Mannequin',
      },
    ])
  })
})

describe('shapeTagNode', () => {
  test('annotated tag: tagger.date を UTC に正規化して使う', () => {
    const result = shapeTagNode({
      name: 'v1.0.0',
      target: {
        __typename: 'Tag',
        oid: 'tag-oid',
        tagger: { date: '2024-01-15T10:00:00+09:00' },
        target: {
          __typename: 'Commit',
          oid: 'commit-sha',
          committedDate: '2024-01-10T00:00:00Z',
        },
      },
    })

    expect(result).toEqual({
      name: 'v1.0.0',
      sha: 'commit-sha',
      committedAt: '2024-01-15T01:00:00.000Z',
    })
  })

  test('annotated tag: tagger が null なら committedDate にフォールバック', () => {
    const result = shapeTagNode({
      name: 'v1.0.0',
      target: {
        __typename: 'Tag',
        oid: 'tag-oid',
        tagger: null,
        target: {
          __typename: 'Commit',
          oid: 'commit-sha',
          committedDate: '2024-01-10T00:00:00Z',
        },
      },
    })

    expect(result).toEqual({
      name: 'v1.0.0',
      sha: 'commit-sha',
      committedAt: '2024-01-10T00:00:00.000Z',
    })
  })

  test('lightweight tag: committedDate をそのまま使う', () => {
    const result = shapeTagNode({
      name: 'v2.0.0',
      target: {
        __typename: 'Commit',
        oid: 'commit-sha',
        committedDate: '2024-02-01T00:00:00Z',
      },
    })

    expect(result).toEqual({
      name: 'v2.0.0',
      sha: 'commit-sha',
      committedAt: '2024-02-01T00:00:00Z',
    })
  })

  test('target が null なら null を返す', () => {
    expect(shapeTagNode({ name: 'v1.0.0', target: null })).toBeNull()
  })

  test('annotated tag の inner target が Commit 以外なら null を返す', () => {
    const result = shapeTagNode({
      name: 'v1.0.0',
      target: {
        __typename: 'Tag',
        oid: 'tag-oid',
        target: { __typename: 'Tree' },
      },
    })

    expect(result).toBeNull()
  })
})

describe('paginateGraphQL shouldStop', () => {
  type Node = { number: number; updatedAt: string }
  const makeGraphqlFn = (pages: Node[][]) => {
    let callIndex = 0
    return (_vars: Record<string, unknown>) => {
      const nodes = pages[callIndex++] ?? []
      return Promise.resolve({
        pullRequests: {
          nodes,
          pageInfo: {
            hasNextPage: callIndex < pages.length,
            endCursor: `cursor-${callIndex}`,
          },
        },
      })
    }
  }
  type Result = Awaited<ReturnType<ReturnType<typeof makeGraphqlFn>>>

  const extractConnection = (r: Result) => r.pullRequests
  const processNode = (n: Node) => n

  test('excludes node with updatedAt equal to stopBefore', async () => {
    const stopBefore = '2026-04-01T00:00:00Z'
    const pages: Node[][] = [
      [
        { number: 3, updatedAt: '2026-04-02T00:00:00Z' },
        { number: 2, updatedAt: '2026-04-01T00:00:00Z' }, // == stopBefore → 除外
        { number: 1, updatedAt: '2026-03-31T00:00:00Z' },
      ],
    ]
    const result = await paginateGraphQL(
      makeGraphqlFn(pages),
      extractConnection,
      processNode,
      { shouldStop: (node) => node.updatedAt <= stopBefore },
    )
    expect(result).toEqual([{ number: 3, updatedAt: '2026-04-02T00:00:00Z' }])
  })

  test('includes nodes newer than stopBefore', async () => {
    const stopBefore = '2026-04-01T00:00:00Z'
    const pages: Node[][] = [
      [
        { number: 5, updatedAt: '2026-04-03T00:00:00Z' },
        { number: 4, updatedAt: '2026-04-02T00:00:00Z' },
        { number: 3, updatedAt: '2026-03-31T00:00:00Z' }, // older → stop
      ],
    ]
    const result = await paginateGraphQL(
      makeGraphqlFn(pages),
      extractConnection,
      processNode,
      { shouldStop: (node) => node.updatedAt <= stopBefore },
    )
    expect(result).toEqual([
      { number: 5, updatedAt: '2026-04-03T00:00:00Z' },
      { number: 4, updatedAt: '2026-04-02T00:00:00Z' },
    ])
  })

  test('returns all nodes when shouldStop is not provided', async () => {
    const pages: Node[][] = [
      [
        { number: 1, updatedAt: '2026-04-01T00:00:00Z' },
        { number: 2, updatedAt: '2026-03-01T00:00:00Z' },
      ],
    ]
    const result = await paginateGraphQL(
      makeGraphqlFn(pages),
      extractConnection,
      processNode,
    )
    expect(result).toEqual([
      { number: 1, updatedAt: '2026-04-01T00:00:00Z' },
      { number: 2, updatedAt: '2026-03-01T00:00:00Z' },
    ])
  })
})
