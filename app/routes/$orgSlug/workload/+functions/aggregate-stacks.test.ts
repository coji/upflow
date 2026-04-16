import { describe, expect, test } from 'vitest'
import {
  AUTO_MERGE_SUGGESTION_THRESHOLD,
  DEFAULT_PERSONAL_LIMIT,
  aggregateTeamStacks,
} from './aggregate-stacks'

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
    ...overrides,
  }
}

function makeReviewHistory(
  overrides: Partial<{
    number: number
    repositoryId: string
    reviewer: string
    reviewerDisplayName: string | null
    state: string
    submittedAt: string
  }> = {},
) {
  return {
    number: 1,
    repositoryId: 'repo-1',
    reviewer: 'bob',
    reviewerDisplayName: null,
    state: 'APPROVED',
    submittedAt: '2026-03-02T00:00:00Z',
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
    const result = aggregateTeamStacks({ openPRs: [], pendingReviews: [] })
    expect(result).toEqual({
      authorStacks: [],
      reviewerStacks: [],
      unassignedPRs: [],
      approvedAwaitingMergePRs: [],
      changesPendingPRs: [],
      personalLimit: DEFAULT_PERSONAL_LIMIT,
      insight: null,
      autoMergeSuggestion: false,
    })
  })

  test('groups open PRs by author', () => {
    const openPRs = [
      makePR({ author: 'alice', number: 1 }),
      makePR({ author: 'alice', number: 2 }),
      makePR({ author: 'bob', number: 3 }),
    ]
    const result = aggregateTeamStacks({ openPRs, pendingReviews: [] })

    expect(result.authorStacks).toHaveLength(2)
    const alice = result.authorStacks.find((s) => s.login === 'alice')
    const bob = result.authorStacks.find((s) => s.login === 'bob')
    expect(alice?.prs).toHaveLength(2)
    expect(bob?.prs).toHaveLength(1)
  })

  test('author stacks sorted by PR count descending', () => {
    const openPRs = [
      makePR({ author: 'bob', number: 1 }),
      makePR({ author: 'alice', number: 2 }),
      makePR({ author: 'alice', number: 3 }),
      makePR({ author: 'alice', number: 4 }),
    ]
    const result = aggregateTeamStacks({ openPRs, pendingReviews: [] })
    expect(result.authorStacks[0].login).toBe('alice')
    expect(result.authorStacks[1].login).toBe('bob')
  })

  test('uses authorDisplayName when available, falls back to login', () => {
    const openPRs = [
      makePR({ author: 'alice', authorDisplayName: 'Alice Smith' }),
      makePR({ author: 'bob', authorDisplayName: null, number: 2 }),
    ]
    const result = aggregateTeamStacks({ openPRs, pendingReviews: [] })
    const alice = result.authorStacks.find((s) => s.login === 'alice')
    const bob = result.authorStacks.find((s) => s.login === 'bob')
    expect(alice?.displayName).toBe('Alice Smith')
    expect(bob?.displayName).toBe('bob')
  })

  test('groups pending reviews by reviewer', () => {
    const pendingReviews = [
      makeReview({ reviewer: 'bob', number: 1 }),
      makeReview({ reviewer: 'bob', number: 2 }),
      makeReview({ reviewer: 'carol', number: 3 }),
    ]
    const result = aggregateTeamStacks({ openPRs: [], pendingReviews })

    expect(result.reviewerStacks).toHaveLength(2)
    const bob = result.reviewerStacks.find((s) => s.login === 'bob')
    const carol = result.reviewerStacks.find((s) => s.login === 'carol')
    expect(bob?.prs).toHaveLength(2)
    expect(carol?.prs).toHaveLength(1)
  })

  test('deduplicates reviewer entries for the same PR', () => {
    const pendingReviews = [
      makeReview({ reviewer: 'bob', number: 1, repositoryId: 'repo-1' }),
      makeReview({ reviewer: 'bob', number: 1, repositoryId: 'repo-1' }),
    ]
    const result = aggregateTeamStacks({ openPRs: [], pendingReviews })
    const bob = result.reviewerStacks.find((s) => s.login === 'bob')
    expect(bob?.prs).toHaveLength(1)
  })

  test('marks PRs with reviewers in author stacks', () => {
    const openPRs = [
      makePR({ author: 'alice', number: 1 }),
      makePR({ author: 'alice', number: 2 }),
    ]
    const pendingReviews = [makeReview({ reviewer: 'bob', number: 1 })]
    const result = aggregateTeamStacks({ openPRs, pendingReviews })

    const alice = result.authorStacks[0]
    const pr1 = alice.prs.find((p) => p.number === 1)
    const pr2 = alice.prs.find((p) => p.number === 2)
    expect(pr1?.hasReviewer).toBe(true)
    expect(pr1?.reviewStatus).toBe('in-review')
    expect(pr1?.reviewerStates?.map((r) => r.login)).toEqual(['bob'])
    expect(pr2?.hasReviewer).toBe(false)
    expect(pr2?.reviewStatus).toBe('unassigned')
    expect(pr2?.reviewerStates).toBeUndefined()
  })

  test('collects multiple reviewers for same PR', () => {
    const openPRs = [makePR({ author: 'alice', number: 1 })]
    const pendingReviews = [
      makeReview({ reviewer: 'bob', number: 1 }),
      makeReview({ reviewer: 'carol', number: 1 }),
    ]
    const result = aggregateTeamStacks({ openPRs, pendingReviews })

    const pr = result.authorStacks[0].prs[0]
    const logins = pr.reviewerStates?.map((r) => r.login)
    expect(logins).toHaveLength(2)
    expect(logins).toContain('bob')
    expect(logins).toContain('carol')
  })

  describe('reviewerStates (per-reviewer state for popover)', () => {
    test('attaches latest state per reviewer from review history', () => {
      const openPRs = [makePR({ author: 'alice', number: 1 })]
      const pendingReviews = [makeReview({ reviewer: 'bob', number: 1 })]
      const reviewHistory = [
        makeReviewHistory({
          reviewer: 'bob',
          state: 'COMMENTED',
          submittedAt: '2026-03-02T00:00:00Z',
        }),
        makeReviewHistory({
          reviewer: 'bob',
          state: 'APPROVED',
          submittedAt: '2026-03-05T00:00:00Z',
        }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews,
        reviewHistory,
      })

      const pr = result.authorStacks[0].prs[0]
      expect(pr.reviewerStates).toHaveLength(1)
      expect(pr.reviewerStates?.[0]).toMatchObject({
        login: 'bob',
        state: 'APPROVED',
        submittedAt: '2026-03-05T00:00:00Z',
      })
    })

    test('REQUESTED reviewer (no submitted review) appears without submittedAt', () => {
      const openPRs = [makePR({ author: 'alice', number: 1 })]
      const pendingReviews = [makeReview({ reviewer: 'carol', number: 1 })]
      const result = aggregateTeamStacks({ openPRs, pendingReviews })

      const pr = result.authorStacks[0].prs[0]
      expect(pr.reviewerStates).toEqual([
        {
          login: 'carol',
          displayName: 'carol',
          state: 'REQUESTED',
        },
      ])
    })

    test('reviewer with submitted review overrides REQUESTED from pending list', () => {
      const openPRs = [makePR({ author: 'alice', number: 1 })]
      const pendingReviews = [makeReview({ reviewer: 'bob', number: 1 })]
      const reviewHistory = [
        makeReviewHistory({
          reviewer: 'bob',
          state: 'CHANGES_REQUESTED',
          submittedAt: '2026-03-03T00:00:00Z',
        }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews,
        reviewHistory,
      })

      const pr = result.authorStacks[0].prs[0]
      expect(pr.reviewerStates).toHaveLength(1)
      expect(pr.reviewerStates?.[0].state).toBe('CHANGES_REQUESTED')
    })

    test('multiple reviewers sorted by state priority', () => {
      const openPRs = [makePR({ author: 'alice', number: 1 })]
      const pendingReviews = [makeReview({ reviewer: 'dave', number: 1 })]
      const reviewHistory = [
        makeReviewHistory({
          reviewer: 'bob',
          state: 'APPROVED',
          submittedAt: '2026-03-05T00:00:00Z',
        }),
        makeReviewHistory({
          reviewer: 'carol',
          state: 'COMMENTED',
          submittedAt: '2026-03-05T00:00:00Z',
        }),
        makeReviewHistory({
          reviewer: 'ellen',
          state: 'CHANGES_REQUESTED',
          submittedAt: '2026-03-05T00:00:00Z',
        }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews,
        reviewHistory,
      })

      const states = result.authorStacks[0].prs[0].reviewerStates?.map(
        (r) => r.state,
      )
      expect(states).toEqual([
        'APPROVED',
        'CHANGES_REQUESTED',
        'COMMENTED',
        'REQUESTED',
      ])
    })

    test('DISMISSED / PENDING review states are filtered out', () => {
      const openPRs = [makePR({ author: 'alice', number: 1 })]
      const reviewHistory = [
        makeReviewHistory({ reviewer: 'bob', state: 'DISMISSED' }),
        makeReviewHistory({ reviewer: 'carol', state: 'PENDING' }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.authorStacks[0].prs[0].reviewerStates).toBeUndefined()
    })

    test('bucket PRs also carry reviewerStates', () => {
      const openPRs = [makePR({ number: 1 })]
      const reviewHistory = [
        makeReviewHistory({
          reviewer: 'bob',
          state: 'APPROVED',
          submittedAt: '2026-03-05T00:00:00Z',
        }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.approvedAwaitingMergePRs[0].reviewerStates?.[0].state).toBe(
        'APPROVED',
      )
    })

    test('case-insensitive reviewer matching', () => {
      const openPRs = [makePR({ author: 'alice', number: 1 })]
      const pendingReviews = [makeReview({ reviewer: 'Bob', number: 1 })]
      const reviewHistory = [
        makeReviewHistory({
          reviewer: 'bob',
          state: 'APPROVED',
          submittedAt: '2026-03-05T00:00:00Z',
        }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews,
        reviewHistory,
      })

      const states = result.authorStacks[0].prs[0].reviewerStates
      expect(states).toHaveLength(1)
      expect(states?.[0].state).toBe('APPROVED')
    })

    test('author self-comment only → treated as unassigned', () => {
      const openPRs = [makePR({ author: 'alice', number: 1 })]
      const reviewHistory = [
        makeReviewHistory({
          reviewer: 'alice',
          state: 'COMMENTED',
          submittedAt: '2026-03-02T00:00:00Z',
        }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.unassignedPRs).toHaveLength(1)
      expect(result.unassignedPRs[0].reviewStatus).toBe('unassigned')
      expect(result.changesPendingPRs).toHaveLength(0)
    })

    test('author self-comment + other reviewer → uses other reviewer state', () => {
      const openPRs = [makePR({ author: 'alice', number: 1 })]
      const reviewHistory = [
        makeReviewHistory({
          reviewer: 'alice',
          state: 'COMMENTED',
          submittedAt: '2026-03-02T00:00:00Z',
        }),
        makeReviewHistory({
          reviewer: 'bob',
          state: 'CHANGES_REQUESTED',
          submittedAt: '2026-03-03T00:00:00Z',
        }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.changesPendingPRs).toHaveLength(1)
      expect(result.unassignedPRs).toHaveLength(0)
    })
  })

  describe('review status buckets', () => {
    test('truly unassigned → unassignedPRs', () => {
      const openPRs = [makePR({ number: 1 })]
      const result = aggregateTeamStacks({ openPRs, pendingReviews: [] })

      expect(result.unassignedPRs).toHaveLength(1)
      expect(result.unassignedPRs[0].reviewStatus).toBe('unassigned')
      expect(result.approvedAwaitingMergePRs).toHaveLength(0)
      expect(result.changesPendingPRs).toHaveLength(0)
    })

    test('approved with no current reviewer → approvedAwaitingMergePRs', () => {
      const openPRs = [makePR({ number: 1 })]
      const reviewHistory = [
        makeReviewHistory({ reviewer: 'bob', state: 'APPROVED' }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.approvedAwaitingMergePRs).toHaveLength(1)
      expect(result.approvedAwaitingMergePRs[0].reviewStatus).toBe(
        'approved-awaiting-merge',
      )
      expect(result.unassignedPRs).toHaveLength(0)
      expect(result.changesPendingPRs).toHaveLength(0)
    })

    test('changes_requested only → changesPendingPRs', () => {
      const openPRs = [makePR({ number: 1 })]
      const reviewHistory = [
        makeReviewHistory({ reviewer: 'bob', state: 'CHANGES_REQUESTED' }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.changesPendingPRs).toHaveLength(1)
      expect(result.changesPendingPRs[0].reviewStatus).toBe('changes-pending')
      expect(result.unassignedPRs).toHaveLength(0)
      expect(result.approvedAwaitingMergePRs).toHaveLength(0)
    })

    test('commented only (no approve/changes) → unassignedPRs', () => {
      const openPRs = [makePR({ number: 1 })]
      const reviewHistory = [
        makeReviewHistory({ reviewer: 'bob', state: 'COMMENTED' }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.unassignedPRs).toHaveLength(1)
      expect(result.unassignedPRs[0].reviewStatus).toBe('unassigned')
      expect(result.changesPendingPRs).toHaveLength(0)
    })

    test('approved takes priority over changes_requested', () => {
      const openPRs = [makePR({ number: 1 })]
      const reviewHistory = [
        makeReviewHistory({
          reviewer: 'bob',
          state: 'APPROVED',
          submittedAt: '2026-03-05T00:00:00Z',
        }),
        makeReviewHistory({
          reviewer: 'carol',
          state: 'CHANGES_REQUESTED',
          submittedAt: '2026-03-05T00:00:00Z',
        }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.approvedAwaitingMergePRs).toHaveLength(1)
      expect(result.changesPendingPRs).toHaveLength(0)
    })

    test('PRs with active review requests never appear in any bucket', () => {
      const openPRs = [makePR({ number: 1 })]
      const pendingReviews = [makeReview({ reviewer: 'bob', number: 1 })]
      const reviewHistory = [
        makeReviewHistory({ reviewer: 'carol', state: 'APPROVED' }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews,
        reviewHistory,
      })

      expect(result.unassignedPRs).toHaveLength(0)
      expect(result.approvedAwaitingMergePRs).toHaveLength(0)
      expect(result.changesPendingPRs).toHaveLength(0)
    })

    test('author stack PRs carry reviewStatus for all buckets', () => {
      const openPRs = [
        makePR({ author: 'alice', number: 1 }),
        makePR({ author: 'alice', number: 2 }),
      ]
      const reviewHistory = [
        makeReviewHistory({ number: 1, reviewer: 'bob', state: 'APPROVED' }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })
      const alice = result.authorStacks[0]
      expect(alice.prs.find((p) => p.number === 1)?.reviewStatus).toBe(
        'approved-awaiting-merge',
      )
      expect(alice.prs.find((p) => p.number === 2)?.reviewStatus).toBe(
        'unassigned',
      )
    })
  })

  describe('insight generation', () => {
    test('generates insight when authors exceed personal limit', () => {
      const openPRs = [
        makePR({ author: 'alice', number: 1 }),
        makePR({ author: 'alice', number: 2 }),
        makePR({ author: 'alice', number: 3 }),
      ]
      const pendingReviews = [
        makeReview({ reviewer: 'bob', number: 1 }),
        makeReview({ reviewer: 'bob', number: 2 }),
        makeReview({ reviewer: 'bob', number: 3 }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews,
        personalLimit: 2,
      })

      expect(result.insight).toContain('1人が目安（2件）を超過中')
    })

    test('generates insight when reviewer has concentrated reviews', () => {
      const openPRs = [
        makePR({ author: 'alice', number: 1 }),
        makePR({ author: 'alice', number: 2 }),
        makePR({ author: 'alice', number: 3 }),
      ]
      const pendingReviews = [
        makeReview({ reviewer: 'bob', number: 1 }),
        makeReview({ reviewer: 'bob', number: 2 }),
        makeReview({ reviewer: 'bob', number: 3 }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews,
        personalLimit: 2,
      })

      expect(result.insight).toContain('bobに3件のレビューが集中')
    })

    test('generates insight for truly unassigned PRs', () => {
      const openPRs = [makePR({ author: 'alice', number: 1 })]
      const result = aggregateTeamStacks({ openPRs, pendingReviews: [] })

      expect(result.insight).toContain('1件のPRがレビュアー未アサイン')
    })

    test('generates insight for approved-awaiting-merge PRs', () => {
      const openPRs = [makePR({ number: 1 })]
      const reviewHistory = [
        makeReviewHistory({ reviewer: 'bob', state: 'APPROVED' }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.insight).toContain('1件がApprove済みマージ待ち')
    })

    test('generates insight for changes-pending PRs', () => {
      const openPRs = [makePR({ number: 1 })]
      const reviewHistory = [
        makeReviewHistory({ reviewer: 'bob', state: 'CHANGES_REQUESTED' }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.insight).toContain('1件が作者対応待ち')
    })

    test('autoMergeSuggestion false when approvedAwaitingMerge below threshold', () => {
      const openPRs = Array.from(
        { length: AUTO_MERGE_SUGGESTION_THRESHOLD - 1 },
        (_, i) => makePR({ number: i + 1 }),
      )
      const reviewHistory = openPRs.map((pr) =>
        makeReviewHistory({
          number: pr.number,
          reviewer: 'bob',
          state: 'APPROVED',
        }),
      )
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.autoMergeSuggestion).toBe(false)
      expect(result.insight ?? '').not.toContain('auto-merge')
    })

    test('autoMergeSuggestion true when approvedAwaitingMerge at/above threshold', () => {
      const openPRs = Array.from(
        { length: AUTO_MERGE_SUGGESTION_THRESHOLD },
        (_, i) => makePR({ number: i + 1 }),
      )
      const reviewHistory = openPRs.map((pr) =>
        makeReviewHistory({
          number: pr.number,
          reviewer: 'bob',
          state: 'APPROVED',
        }),
      )
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews: [],
        reviewHistory,
      })

      expect(result.autoMergeSuggestion).toBe(true)
      expect(result.insight).toContain('auto-merge-on-approved')
    })

    test('no insight when all within limit and all in-review', () => {
      const openPRs = [
        makePR({ author: 'alice', number: 1 }),
        makePR({ author: 'bob', number: 2 }),
      ]
      const pendingReviews = [
        makeReview({ reviewer: 'carol', number: 1 }),
        makeReview({ reviewer: 'carol', number: 2 }),
      ]
      const result = aggregateTeamStacks({
        openPRs,
        pendingReviews,
        personalLimit: 5,
      })

      expect(result.insight).toBeNull()
      expect(result.autoMergeSuggestion).toBe(false)
    })
  })

  test('uses custom personalLimit', () => {
    const openPRs = [makePR({ author: 'alice', number: 1 })]
    const result = aggregateTeamStacks({
      openPRs,
      pendingReviews: [],
      personalLimit: 10,
    })
    expect(result.personalLimit).toBe(10)
  })

  test('uses DEFAULT_PERSONAL_LIMIT when not specified', () => {
    const result = aggregateTeamStacks({ openPRs: [], pendingReviews: [] })
    expect(result.personalLimit).toBe(DEFAULT_PERSONAL_LIMIT)
  })
})
