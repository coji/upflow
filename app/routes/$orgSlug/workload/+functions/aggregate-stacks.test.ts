import { describe, expect, test } from 'vitest'
import { DEFAULT_PERSONAL_LIMIT, aggregateTeamStacks } from './aggregate-stacks'

function makePR(
  overrides: Partial<{
    author: string
    authorDisplayName: string | null
    number: number
    repositoryId: string
    repo: string
    title: string
    url: string
    pullRequestCreatedAt: string
    complexity: string | null
    hasAnyReviewer: boolean
  }> = {},
) {
  return {
    author: 'alice',
    authorDisplayName: null,
    number: 1,
    repositoryId: 'repo-1',
    repo: 'my-repo',
    title: 'PR title',
    url: 'https://github.com/org/repo/pull/1',
    pullRequestCreatedAt: '2026-03-01T00:00:00Z',
    complexity: null,
    hasAnyReviewer: false,
    ...overrides,
  }
}

function makeReview(
  overrides: Partial<{
    reviewer: string
    reviewerDisplayName: string | null
    number: number
    repositoryId: string
    repo: string
    title: string
    url: string
    author: string
    pullRequestCreatedAt: string
    complexity: string | null
  }> = {},
) {
  return {
    reviewer: 'bob',
    reviewerDisplayName: null,
    number: 1,
    repositoryId: 'repo-1',
    repo: 'my-repo',
    title: 'PR title',
    url: 'https://github.com/org/repo/pull/1',
    author: 'alice',
    pullRequestCreatedAt: '2026-03-01T00:00:00Z',
    complexity: null,
    ...overrides,
  }
}

describe('aggregateTeamStacks', () => {
  test('empty data returns empty stacks and no insight', () => {
    const result = aggregateTeamStacks([], [])
    expect(result).toEqual({
      authorStacks: [],
      reviewerStacks: [],
      unassignedPRs: [],
      personalLimit: DEFAULT_PERSONAL_LIMIT,
      insight: null,
    })
  })

  test('groups open PRs by author', () => {
    const prs = [
      makePR({ author: 'alice', number: 1 }),
      makePR({ author: 'alice', number: 2 }),
      makePR({ author: 'bob', number: 3 }),
    ]
    const result = aggregateTeamStacks(prs, [])

    expect(result.authorStacks).toHaveLength(2)
    const alice = result.authorStacks.find((s) => s.login === 'alice')
    const bob = result.authorStacks.find((s) => s.login === 'bob')
    expect(alice?.prs).toHaveLength(2)
    expect(bob?.prs).toHaveLength(1)
  })

  test('author stacks sorted by PR count descending', () => {
    const prs = [
      makePR({ author: 'bob', number: 1 }),
      makePR({ author: 'alice', number: 2 }),
      makePR({ author: 'alice', number: 3 }),
      makePR({ author: 'alice', number: 4 }),
    ]
    const result = aggregateTeamStacks(prs, [])
    expect(result.authorStacks[0].login).toBe('alice')
    expect(result.authorStacks[1].login).toBe('bob')
  })

  test('uses authorDisplayName when available, falls back to login', () => {
    const prs = [
      makePR({ author: 'alice', authorDisplayName: 'Alice Smith' }),
      makePR({ author: 'bob', authorDisplayName: null, number: 2 }),
    ]
    const result = aggregateTeamStacks(prs, [])
    const alice = result.authorStacks.find((s) => s.login === 'alice')
    const bob = result.authorStacks.find((s) => s.login === 'bob')
    expect(alice?.displayName).toBe('Alice Smith')
    expect(bob?.displayName).toBe('bob')
  })

  test('groups pending reviews by reviewer', () => {
    const reviews = [
      makeReview({ reviewer: 'bob', number: 1 }),
      makeReview({ reviewer: 'bob', number: 2 }),
      makeReview({ reviewer: 'carol', number: 3 }),
    ]
    const result = aggregateTeamStacks([], reviews)

    expect(result.reviewerStacks).toHaveLength(2)
    const bob = result.reviewerStacks.find((s) => s.login === 'bob')
    const carol = result.reviewerStacks.find((s) => s.login === 'carol')
    expect(bob?.prs).toHaveLength(2)
    expect(carol?.prs).toHaveLength(1)
  })

  test('deduplicates reviewer entries for the same PR', () => {
    const reviews = [
      makeReview({ reviewer: 'bob', number: 1, repositoryId: 'repo-1' }),
      makeReview({ reviewer: 'bob', number: 1, repositoryId: 'repo-1' }),
    ]
    const result = aggregateTeamStacks([], reviews)
    const bob = result.reviewerStacks.find((s) => s.login === 'bob')
    expect(bob?.prs).toHaveLength(1)
  })

  test('marks PRs with reviewers in author stacks', () => {
    const prs = [
      makePR({ author: 'alice', number: 1, hasAnyReviewer: true }),
      makePR({ author: 'alice', number: 2, hasAnyReviewer: false }),
    ]
    const reviews = [makeReview({ reviewer: 'bob', number: 1 })]
    const result = aggregateTeamStacks(prs, reviews)

    const alice = result.authorStacks[0]
    const pr1 = alice.prs.find((p) => p.number === 1)
    const pr2 = alice.prs.find((p) => p.number === 2)
    expect(pr1?.hasReviewer).toBe(true)
    expect(pr1?.reviewers).toEqual(['bob'])
    expect(pr2?.hasReviewer).toBe(false)
    expect(pr2?.reviewers).toBeUndefined()
  })

  test('collects multiple reviewers for same PR', () => {
    const prs = [makePR({ author: 'alice', number: 1, hasAnyReviewer: true })]
    const reviews = [
      makeReview({ reviewer: 'bob', number: 1 }),
      makeReview({ reviewer: 'carol', number: 1 }),
    ]
    const result = aggregateTeamStacks(prs, reviews)

    const pr = result.authorStacks[0].prs[0]
    expect(pr.reviewers).toHaveLength(2)
    expect(pr.reviewers).toContain('bob')
    expect(pr.reviewers).toContain('carol')
  })

  test('identifies unassigned PRs (never had a reviewer)', () => {
    const prs = [
      makePR({ author: 'alice', number: 1, hasAnyReviewer: true }),
      makePR({ author: 'alice', number: 2, hasAnyReviewer: false }),
    ]
    const reviews = [makeReview({ reviewer: 'bob', number: 1 })]
    const result = aggregateTeamStacks(prs, reviews)

    expect(result.unassignedPRs).toHaveLength(1)
    expect(result.unassignedPRs[0].number).toBe(2)
  })

  test('generates insight when authors exceed personal limit', () => {
    const prs = [
      makePR({ author: 'alice', number: 1, hasAnyReviewer: true }),
      makePR({ author: 'alice', number: 2, hasAnyReviewer: true }),
      makePR({ author: 'alice', number: 3, hasAnyReviewer: true }),
    ]
    const reviews = [
      makeReview({ reviewer: 'bob', number: 1 }),
      makeReview({ reviewer: 'bob', number: 2 }),
      makeReview({ reviewer: 'bob', number: 3 }),
    ]
    const result = aggregateTeamStacks(prs, reviews, 2)

    expect(result.insight).toContain('1人が目安（2件）を超過中')
  })

  test('generates insight when reviewer has concentrated reviews', () => {
    const prs = [
      makePR({ author: 'alice', number: 1, hasAnyReviewer: true }),
      makePR({ author: 'alice', number: 2, hasAnyReviewer: true }),
      makePR({ author: 'alice', number: 3, hasAnyReviewer: true }),
    ]
    const reviews = [
      makeReview({ reviewer: 'bob', number: 1 }),
      makeReview({ reviewer: 'bob', number: 2 }),
      makeReview({ reviewer: 'bob', number: 3 }),
    ]
    const result = aggregateTeamStacks(prs, reviews, 2)

    expect(result.insight).toContain('bobに3件のレビューが集中')
  })

  test('generates insight for unassigned PRs only', () => {
    const prs = [makePR({ author: 'alice', number: 1 })]
    const result = aggregateTeamStacks(prs, [])

    expect(result.insight).toBe('1件のPRがレビュアー未アサイン。')
  })

  test('no insight when all within limit and all assigned', () => {
    const prs = [
      makePR({ author: 'alice', number: 1, hasAnyReviewer: true }),
      makePR({ author: 'bob', number: 2, hasAnyReviewer: true }),
    ]
    const reviews = [
      makeReview({ reviewer: 'carol', number: 1 }),
      makeReview({ reviewer: 'carol', number: 2 }),
    ]
    const result = aggregateTeamStacks(prs, reviews, 5)

    expect(result.insight).toBeNull()
  })

  test('uses custom personalLimit', () => {
    const prs = [makePR({ author: 'alice', number: 1 })]
    const result = aggregateTeamStacks(prs, [], 10)
    expect(result.personalLimit).toBe(10)
  })

  test('uses DEFAULT_PERSONAL_LIMIT when not specified', () => {
    const result = aggregateTeamStacks([], [])
    expect(result.personalLimit).toBe(DEFAULT_PERSONAL_LIMIT)
  })
})
