import { describe, expect, test } from 'vitest'
import type {
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedTimelineItem,
} from '~/batch/github/model'
import {
  computeFirstReviewedAt,
  deriveReviewWait,
  inferInitialState,
  normalizeTimelineEvents,
} from './review-wait'

// computeFirstReviewedAt は filterActors 済みデータを受け取る前提

const makePr = (
  overrides: Partial<ShapedGitHubPullRequest> = {},
): ShapedGitHubPullRequest =>
  ({
    id: 1,
    organization: 'org',
    repo: 'repo',
    number: 1,
    state: 'open' as const,
    title: 'test',
    body: null,
    url: 'https://github.com/org/repo/pull/1',
    author: 'author',
    authorIsBot: false,
    assignees: [],
    reviewers: [],
    draft: false,
    sourceBranch: 'feature',
    targetBranch: 'main',
    createdAt: '2022-08-01T10:00:00Z',
    updatedAt: '2022-08-01T10:00:00Z',
    mergedAt: null,
    closedAt: null,
    mergeCommitSha: null,
    additions: 10,
    deletions: 5,
    changedFiles: 2,
    files: [],
    ...overrides,
  }) satisfies ShapedGitHubPullRequest

const makeTimeline = (
  type: string,
  createdAt: string,
  reviewer?: string,
  reviewerType?: 'User' | 'Bot' | 'Mannequin' | 'Team',
): ShapedTimelineItem => ({
  type,
  createdAt,
  reviewer: reviewer ?? null,
  reviewerType: reviewerType ?? null,
})

const botLogins = new Set<string>(['ci-bot'])

// --- inferInitialState ---

describe('inferInitialState', () => {
  test('ReadyForReviewEvent first → DraftIdle', () => {
    const timeline = normalizeTimelineEvents(
      [makeTimeline('ReadyForReviewEvent', '2022-08-01T11:00:00Z')],
      makePr(),
      botLogins,
    )
    expect(inferInitialState(makePr(), timeline)).toBe('draft')
  })

  test('ConvertToDraftEvent first → ReadyIdle', () => {
    const timeline = normalizeTimelineEvents(
      [makeTimeline('ConvertToDraftEvent', '2022-08-01T11:00:00Z')],
      makePr(),
      botLogins,
    )
    expect(inferInitialState(makePr(), timeline)).toBe('ready')
  })

  test('no draft events, pr.draft=true → DraftIdle', () => {
    const timeline = normalizeTimelineEvents(
      [],
      makePr({ draft: true }),
      botLogins,
    )
    expect(inferInitialState(makePr({ draft: true }), timeline)).toBe('draft')
  })

  test('no draft events, pr.draft=false → ReadyIdle', () => {
    const timeline = normalizeTimelineEvents([], makePr(), botLogins)
    expect(inferInitialState(makePr(), timeline)).toBe('ready')
  })
})

// --- normalizeTimelineEvents ---

describe('normalizeTimelineEvents', () => {
  test('filters out ineligible reviewer events (bot)', () => {
    const items = [
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T10:00:00Z',
        'ci-bot',
        'Bot',
      ),
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T11:00:00Z',
        'alice',
        'User',
      ),
    ]
    const result = normalizeTimelineEvents(items, makePr(), botLogins)
    expect(result).toHaveLength(1)
    expect(result[0].subjectLogin).toBe('alice')
  })

  test('filters out author review requests', () => {
    const items = [
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T10:00:00Z',
        'author',
        'User',
      ),
    ]
    const result = normalizeTimelineEvents(items, makePr(), botLogins)
    expect(result).toHaveLength(0)
  })

  test('sorts by createdAt then event precedence', () => {
    const items = [
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T10:00:00Z',
        'alice',
        'User',
      ),
      makeTimeline('ConvertToDraftEvent', '2022-08-01T10:00:00Z'),
    ]
    const result = normalizeTimelineEvents(items, makePr(), botLogins)
    expect(result[0].type).toBe('ConvertToDraftEvent')
    expect(result[1].type).toBe('ReviewRequestedEvent')
  })
})

// --- deriveReviewWait ---

describe('deriveReviewWait', () => {
  test('simple request → review', () => {
    const pr = makePr()
    const items = [
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T12:00:00Z',
        'alice',
        'User',
      ),
    ]
    const timeline = normalizeTimelineEvents(items, pr, botLogins)
    const result = deriveReviewWait(pr, timeline, '2022-08-01T15:00:00Z')
    expect(result.pickupStartedAt).toBe('2022-08-01T12:00:00Z')
    expect(result.pickupTimeDays).toBeCloseTo(3 / 24, 10)
  })

  test('draft → ready → review (draft period excluded)', () => {
    const pr = makePr({ draft: true })
    const items = [
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T10:00:00Z',
        'alice',
        'User',
      ),
      makeTimeline('ReadyForReviewEvent', '2022-08-01T11:00:00Z'),
    ]
    const timeline = normalizeTimelineEvents(items, pr, botLogins)
    const result = deriveReviewWait(pr, timeline, '2022-08-01T15:00:00Z')
    // active from 11:00 (ready + pending>0) to 15:00 = 4h
    expect(result.pickupStartedAt).toBe('2022-08-01T11:00:00Z')
    expect(result.pickupTimeDays).toBeCloseTo(4 / 24, 10)
  })

  test('draft → ready → draft → ready (multiple intervals)', () => {
    const pr = makePr({ draft: true })
    const items = [
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T10:00:00Z',
        'alice',
        'User',
      ),
      makeTimeline('ReadyForReviewEvent', '2022-08-01T11:00:00Z'),
      makeTimeline('ConvertToDraftEvent', '2022-08-01T12:00:00Z'),
      makeTimeline('ReadyForReviewEvent', '2022-08-01T13:00:00Z'),
    ]
    const timeline = normalizeTimelineEvents(items, pr, botLogins)
    const result = deriveReviewWait(pr, timeline, '2022-08-01T15:00:00Z')
    // interval 1: 11:00-12:00 = 1h, interval 2: 13:00-15:00 = 2h, total = 3h
    expect(result.pickupStartedAt).toBe('2022-08-01T11:00:00Z')
    expect(result.pickupTimeDays).toBeCloseTo(3 / 24, 10)
  })

  test('request → remove → re-request (split intervals)', () => {
    const pr = makePr()
    const items = [
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T10:00:00Z',
        'alice',
        'User',
      ),
      makeTimeline(
        'ReviewRequestRemovedEvent',
        '2022-08-01T12:00:00Z',
        'alice',
        'User',
      ),
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T16:00:00Z',
        'bob',
        'User',
      ),
    ]
    const timeline = normalizeTimelineEvents(items, pr, botLogins)
    const result = deriveReviewWait(pr, timeline, '2022-08-01T18:00:00Z')
    // interval 1: 10:00-12:00 = 2h, interval 2: 16:00-18:00 = 2h, total = 4h
    expect(result.pickupTimeDays).toBeCloseTo(4 / 24, 10)
  })

  test('multiple reviewers, one removed but outstanding remains', () => {
    const pr = makePr()
    const items = [
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T10:00:00Z',
        'alice',
        'User',
      ),
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T10:00:00Z',
        'bob',
        'User',
      ),
      makeTimeline(
        'ReviewRequestRemovedEvent',
        '2022-08-01T12:00:00Z',
        'alice',
        'User',
      ),
    ]
    const timeline = normalizeTimelineEvents(items, pr, botLogins)
    const result = deriveReviewWait(pr, timeline, '2022-08-01T14:00:00Z')
    // continuous interval 10:00-14:00 = 4h (bob still pending)
    expect(result.pickupTimeDays).toBeCloseTo(4 / 24, 10)
  })

  test('bot request is ignored', () => {
    const pr = makePr()
    const items = [
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T10:00:00Z',
        'ci-bot',
        'Bot',
      ),
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T12:00:00Z',
        'alice',
        'User',
      ),
    ]
    const timeline = normalizeTimelineEvents(items, pr, botLogins)
    const result = deriveReviewWait(pr, timeline, '2022-08-01T15:00:00Z')
    // only alice's request counts, 12:00-15:00 = 3h
    expect(result.pickupStartedAt).toBe('2022-08-01T12:00:00Z')
    expect(result.pickupTimeDays).toBeCloseTo(3 / 24, 10)
  })

  test('merge without review closes last interval', () => {
    const pr = makePr({ mergedAt: '2022-08-01T18:00:00Z' })
    const items = [
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T10:00:00Z',
        'alice',
        'User',
      ),
    ]
    const timeline = normalizeTimelineEvents(items, pr, botLogins)
    const result = deriveReviewWait(pr, timeline, null)
    // cutoff = mergedAt, 10:00-18:00 = 8h
    expect(result.pickupTimeDays).toBeCloseTo(8 / 24, 10)
  })

  test('open PR with no review and no merge → null pickupTimeDays', () => {
    const pr = makePr()
    const items = [
      makeTimeline(
        'ReviewRequestedEvent',
        '2022-08-01T10:00:00Z',
        'alice',
        'User',
      ),
    ]
    const timeline = normalizeTimelineEvents(items, pr, botLogins)
    const result = deriveReviewWait(pr, timeline, null)
    expect(result.pickupStartedAt).toBe('2022-08-01T10:00:00Z')
    expect(result.pickupTimeDays).toBeNull()
  })

  test('no review requests → null', () => {
    const pr = makePr()
    const timeline = normalizeTimelineEvents([], pr, botLogins)
    const result = deriveReviewWait(pr, timeline, '2022-08-01T15:00:00Z')
    expect(result.pickupStartedAt).toBeNull()
    expect(result.pickupTimeDays).toBeNull()
  })
})

// --- computeFirstReviewedAt ---

describe('computeFirstReviewedAt', () => {
  test('picks earliest across discussions and reviews', () => {
    const discussions: ShapedGitHubReviewComment[] = [
      {
        id: 1,
        user: 'bob',
        isBot: false,
        createdAt: '2022-08-01T14:00:00Z',
        url: '',
      },
    ]
    const reviews: ShapedGitHubReview[] = [
      {
        id: 2,
        user: 'alice',
        isBot: false,
        state: 'APPROVED',
        submittedAt: '2022-08-01T12:00:00Z',
        url: '',
      },
    ]
    expect(computeFirstReviewedAt(discussions, reviews)).toBe(
      '2022-08-01T12:00:00Z',
    )
  })

  test('discussion earlier than review', () => {
    const discussions: ShapedGitHubReviewComment[] = [
      {
        id: 1,
        user: 'alice',
        isBot: false,
        createdAt: '2022-08-01T10:00:00Z',
        url: '',
      },
    ]
    const reviews: ShapedGitHubReview[] = [
      {
        id: 2,
        user: 'bob',
        isBot: false,
        state: 'APPROVED',
        submittedAt: '2022-08-01T14:00:00Z',
        url: '',
      },
    ]
    expect(computeFirstReviewedAt(discussions, reviews)).toBe(
      '2022-08-01T10:00:00Z',
    )
  })

  test('returns null when no eligible reviews', () => {
    expect(computeFirstReviewedAt([], [])).toBeNull()
  })

  test('excludes PENDING reviews', () => {
    const reviews: ShapedGitHubReview[] = [
      {
        id: 1,
        user: 'alice',
        isBot: false,
        state: 'PENDING',
        submittedAt: '2022-08-01T10:00:00Z',
        url: '',
      },
    ]
    expect(computeFirstReviewedAt([], reviews)).toBeNull()
  })
})
