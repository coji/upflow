import SQLite from 'better-sqlite3'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { closeTenantDb } from '~/app/services/tenant-db.server'
import { toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import type {
  ShapedGitHubCommit,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
  ShapedTimelineItem,
} from './model'
import { createStore, nextFetchedAt } from './store'

// Set up a temp directory for tenant DB
const testDir = path.join(tmpdir(), `store-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

vi.stubEnv('UPFLOW_DATA_DIR', path.dirname(testDbPath))

afterAll(() => {
  vi.unstubAllEnvs()
})

const orgId = toOrgId('test-org')
const repositoryId = 'repo-1'
const tenantDbPath = path.join(testDir, `tenant_${orgId}.db`)

function isoAt(ms: number) {
  return new Date(ms).toISOString()
}

function setupTenantDb() {
  setupTenantSchema(tenantDbPath)
  const db = new SQLite(tenantDbPath)
  db.prepare(
    'INSERT INTO repositories (id, integration_id, provider, owner, repo, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    repositoryId,
    'int-1',
    'github',
    'test-owner',
    'test-repo',
    '2024-01-01T00:00:00Z',
  )
  db.close()
}

function cleanupTenantDb() {
  try {
    unlinkSync(tenantDbPath)
  } catch {
    // ignore
  }
  for (const suffix of ['-wal', '-shm']) {
    try {
      unlinkSync(tenantDbPath + suffix)
    } catch {
      // ignore
    }
  }
}

// Test fixtures
const makePr = (number: number): ShapedGitHubPullRequest => ({
  id: number,
  organization: 'test-owner',
  repo: 'test-repo',
  number,
  state: 'closed',
  title: `PR #${number}`,
  body: null,
  url: `https://github.com/test-owner/test-repo/pull/${number}`,
  author: 'user1',
  authorIsBot: false,
  assignees: [],
  reviewers: [{ login: 'reviewer1', requestedAt: '2024-01-01T06:00:00Z' }],
  draft: false,
  sourceBranch: 'feature',
  targetBranch: 'main',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  mergedAt: '2024-01-02T00:00:00Z',
  closedAt: '2024-01-02T00:00:00Z',
  mergeCommitSha: 'abc123',
  additions: 10,
  deletions: 5,
  changedFiles: 2,
  files: [],
})

const makeCommits = (n: number): ShapedGitHubCommit[] => [
  {
    sha: `commit-${n}-1`,
    url: `https://github.com/commit/${n}-1`,
    committer: 'user1',
    date: '2024-01-01T00:00:00Z',
  },
]

const makeReviews = (n: number): ShapedGitHubReview[] => [
  {
    id: n * 100,
    user: 'reviewer1',
    isBot: false,
    state: 'APPROVED',
    url: `https://github.com/review/${n}`,
    submittedAt: '2024-01-01T12:00:00Z',
  },
]

const makeDiscussions = (n: number): ShapedGitHubReviewComment[] => [
  {
    id: n * 200,
    user: 'reviewer1',
    isBot: false,
    url: `https://github.com/comment/${n}`,
    createdAt: '2024-01-01T10:00:00Z',
  },
]

const makeTimelineItems = (n: number): ShapedTimelineItem[] => [
  {
    type: 'ReviewRequestedEvent',
    createdAt: '2024-01-01T06:00:00Z',
    reviewer: 'reviewer1',
    reviewerType: 'User',
  },
  {
    type: 'ReadyForReviewEvent',
    createdAt: '2024-01-01T05:00:00Z',
    actor: 'user1',
  },
  {
    type: 'MergedEvent',
    createdAt: '2024-01-02T00:00:00Z',
    actor: `user${n}`,
  },
]

describe('store', () => {
  beforeEach(async () => {
    cleanupTenantDb()
    await closeTenantDb(orgId)
    setupTenantDb()
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
    cleanupTenantDb()
  })

  test('savePrData and loaders round-trip', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })
    const pr = makePr(1)
    const commits = makeCommits(1)
    const reviews = makeReviews(1)
    const discussions = makeDiscussions(1)
    const timelineItems = makeTimelineItems(1)

    await store.savePrData(
      pr,
      {
        commits,
        reviews,
        discussions,
        timelineItems,
      },
      null,
    )

    expect(await store.loader.pullrequests()).toEqual([pr])
    expect(await store.loader.commits(1)).toEqual(commits)
    expect(await store.loader.reviews(1)).toEqual(reviews)
    expect(await store.loader.discussions(1)).toEqual(discussions)
    expect(await store.loader.timelineItems(1)).toEqual(timelineItems)
  })

  test('savePrData upserts on conflict', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })
    const pr = makePr(1)

    await store.savePrData(
      pr,
      {
        commits: makeCommits(1),
        reviews: makeReviews(1),
        discussions: makeDiscussions(1),
      },
      null,
    )

    const updatedPr = { ...pr, title: 'Updated PR #1' }
    const updatedCommits: ShapedGitHubCommit[] = [
      ...makeCommits(1),
      {
        sha: 'commit-1-2',
        url: 'https://github.com/commit/1-2',
        committer: 'user1',
        date: '2024-01-01T01:00:00Z',
      },
    ]

    await store.savePrData(
      updatedPr,
      {
        commits: updatedCommits,
        reviews: makeReviews(1),
        discussions: makeDiscussions(1),
      },
      await store.getFetchedAt(1),
    )

    const prs = await store.loader.pullrequests()
    expect(prs).toHaveLength(1)
    expect(prs[0].title).toBe('Updated PR #1')
    expect(await store.loader.commits(1)).toEqual(updatedCommits)
  })

  test('loaders return empty for non-existent PR', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })

    expect(await store.loader.commits(999)).toEqual([])
    expect(await store.loader.reviews(999)).toEqual([])
    expect(await store.loader.discussions(999)).toEqual([])
    expect(await store.loader.timelineItems(999)).toEqual([])
  })

  test('timelineItems defaults to empty when not provided', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })
    const pr = makePr(1)

    await store.savePrData(
      pr,
      {
        commits: makeCommits(1),
        reviews: makeReviews(1),
        discussions: makeDiscussions(1),
      },
      null,
    )

    expect(await store.loader.timelineItems(1)).toEqual([])
  })

  test('saveTags and loader.tags round-trip', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })
    const tags: ShapedGitHubTag[] = [
      { name: 'v1.0.0', sha: 'abc', committedAt: '2024-01-01T00:00:00Z' },
      { name: 'v1.1.0', sha: 'def', committedAt: '2024-01-02T00:00:00Z' },
    ]

    await store.saveTags(tags)

    expect(await store.loader.tags()).toEqual(tags)
  })

  test('tags returns empty when no data', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })
    expect(await store.loader.tags()).toEqual([])
  })

  test('preloadAll enables O(1) access via loaders', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })

    for (const n of [1, 2, 3]) {
      await store.savePrData(
        makePr(n),
        {
          commits: makeCommits(n),
          reviews: makeReviews(n),
          discussions: makeDiscussions(n),
        },
        null,
      )
    }

    await store.preloadAll()

    const prs = await store.loader.pullrequests()
    expect(prs).toHaveLength(3)

    expect(await store.loader.commits(2)).toEqual(makeCommits(2))
    expect(await store.loader.reviews(3)).toEqual(makeReviews(3))
    expect(await store.loader.discussions(1)).toEqual(makeDiscussions(1))
  })

  test('multiple PRs are stored independently', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })

    await store.savePrData(
      makePr(1),
      {
        commits: makeCommits(1),
        reviews: makeReviews(1),
        discussions: makeDiscussions(1),
      },
      null,
    )
    await store.savePrData(
      makePr(2),
      {
        commits: makeCommits(2),
        reviews: makeReviews(2),
        discussions: makeDiscussions(2),
      },
      null,
    )

    expect(await store.loader.pullrequests()).toHaveLength(2)
    expect(await store.loader.commits(1)).toEqual(makeCommits(1))
    expect(await store.loader.commits(2)).toEqual(makeCommits(2))
  })

  test('scan watermark round-trip: null by default, updated via setScanWatermark', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })

    expect(await store.getScanWatermark()).toBeNull()

    await store.setScanWatermark('2024-01-05T00:00:00Z')
    expect(await store.getScanWatermark()).toBe('2024-01-05T00:00:00Z')

    // Watermark lives on repositories.scanWatermark and is independent of
    // githubRawData rows; targeted fetches that write raw data must not
    // implicitly advance it (see #278).
    await store.savePrData(
      { ...makePr(1), updatedAt: '2024-02-10T00:00:00Z' },
      {
        commits: makeCommits(1),
        reviews: makeReviews(1),
        discussions: makeDiscussions(1),
      },
      null,
    )
    expect(await store.getScanWatermark()).toBe('2024-01-05T00:00:00Z')
  })

  test('preloadAll uses lazy parsing (data accessible after preload)', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })

    await store.savePrData(
      makePr(1),
      {
        commits: makeCommits(1),
        reviews: makeReviews(1),
        discussions: makeDiscussions(1),
        timelineItems: makeTimelineItems(1),
      },
      null,
    )

    await store.preloadAll()

    // Data should be accessible via loaders after lazy preload
    const prs = await store.loader.pullrequests()
    expect(prs).toHaveLength(1)
    expect(prs[0].number).toBe(1)

    expect(await store.loader.commits(1)).toEqual(makeCommits(1))
    expect(await store.loader.reviews(1)).toEqual(makeReviews(1))
    expect(await store.loader.discussions(1)).toEqual(makeDiscussions(1))
    expect(await store.loader.timelineItems(1)).toEqual(makeTimelineItems(1))
  })

  const saveInitial = async (
    store: ReturnType<typeof createStore>,
    now: Date,
  ) => {
    const pr = makePr(1)
    expect(
      await store.savePrData(
        pr,
        {
          commits: makeCommits(1),
          reviews: makeReviews(1),
          discussions: makeDiscussions(1),
        },
        null,
        now,
      ),
    ).toBe(true)
    return pr
  }

  test('savePrData refuses to save when another fetch saved the row after expectedFetchedAt was read', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })
    const pr = await saveInitial(store, new Date(1_700_000_000_000))
    // Fetch A reads the row's fetchedAt, then starts its GitHub reads.
    const seenByA = await store.getFetchedAt(1)
    // Fetch B (started earlier or later) saves first.
    const newerPr = { ...pr, title: 'Saved by B' }
    expect(
      await store.savePrData(
        newerPr,
        {
          commits: makeCommits(1),
          reviews: makeReviews(1),
          discussions: makeDiscussions(1),
        },
        seenByA,
        new Date(1_700_000_200_000),
      ),
    ).toBe(true)

    // A's save comes later in time but must not land over B's.
    const stalePr = { ...pr, title: 'Saved by A' }
    expect(
      await store.savePrData(
        stalePr,
        {
          commits: [{ ...makeCommits(1)[0], sha: 'stale-sha' }],
          reviews: makeReviews(1),
          discussions: makeDiscussions(1),
        },
        seenByA,
        new Date(1_700_000_300_000),
      ),
    ).toBe(false)

    const prs = await store.loader.pullrequests()
    expect(prs[0].title).toBe('Saved by B')
    expect(await store.loader.commits(1)).toEqual(makeCommits(1))
  })

  test('savePrData with expectedFetchedAt null refuses when the row now exists', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })
    await saveInitial(store, new Date(1_700_000_000_000))
    expect(
      await store.savePrData(
        { ...makePr(1), title: 'Second insert' },
        {
          commits: makeCommits(1),
          reviews: makeReviews(1),
          discussions: makeDiscussions(1),
        },
        null,
      ),
    ).toBe(false)
    expect((await store.loader.pullrequests())[0].title).toBe('PR #1')
  })

  test('a landed save always moves fetchedAt forward, even when the clock is behind', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })
    await saveInitial(store, new Date(1_700_000_100_000))
    const before = await store.getFetchedAt(1)
    expect(
      await store.savePrData(
        makePr(1),
        {
          commits: makeCommits(1),
          reviews: makeReviews(1),
          discussions: makeDiscussions(1),
        },
        before,
        new Date(1_700_000_000_000),
      ),
    ).toBe(true)
    const after = await store.getFetchedAt(1)
    expect(after).toBe(isoAt(1_700_000_100_001))
  })

  test('nextFetchedAt', () => {
    expect(nextFetchedAt(new Date(5_000), null)).toBe(isoAt(5_000))
    expect(nextFetchedAt(new Date(5_000), isoAt(4_000))).toBe(isoAt(5_000))
    expect(nextFetchedAt(new Date(5_000), isoAt(5_000))).toBe(isoAt(5_001))
    expect(nextFetchedAt(new Date(5_000), isoAt(9_000))).toBe(isoAt(9_001))
  })

  test('updatePrMetadata skips a row saved after expectedFetchedAt was read', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })
    const pr = await saveInitial(store, new Date(1_700_000_000_000))
    const seen = await store.getFetchedAt(1)
    expect(seen).not.toBeNull()
    await store.savePrData(
      { ...pr, title: 'Saved by crawl' },
      {
        commits: makeCommits(1),
        reviews: makeReviews(1),
        discussions: makeDiscussions(1),
      },
      seen,
    )

    const n = await store.updatePrMetadata([
      { pr: { ...pr, title: 'Stale metadata' }, expectedFetchedAt: seen ?? '' },
    ])
    expect(n).toBe(0)
    expect((await store.loader.pullrequests())[0].title).toBe('Saved by crawl')
  })

  test('updatePrMetadata applies when the row is unchanged', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })
    const pr = await saveInitial(store, new Date(1_700_000_000_000))
    const fetchedAtByPr = await store.getFetchedAtByPr()
    const seen = fetchedAtByPr.get(1)
    expect(seen).toBe(isoAt(1_700_000_000_000))

    const n = await store.updatePrMetadata([
      { pr: { ...pr, title: 'New title' }, expectedFetchedAt: seen ?? '' },
    ])
    expect(n).toBe(1)
    expect((await store.loader.pullrequests())[0].title).toBe('New title')
    expect(await store.getFetchedAt(1)).not.toBe(seen)
  })
})
