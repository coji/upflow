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
import type {
  ShapedGitHubCommit,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
  ShapedTimelineItem,
} from './model'

// Set up a temp directory for tenant DB
const testDir = path.join(tmpdir(), `store-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

vi.stubEnv('NODE_ENV', 'production')
vi.stubEnv('DATABASE_URL', `file://${testDbPath}`)

afterAll(() => {
  vi.unstubAllEnvs()
})

const { closeTenantDb } = await import('~/app/services/tenant-db.server')
type OrganizationId = import('~/app/services/tenant-db.server').OrganizationId
const { createStore } = await import('./store')

const orgId = 'test-org' as OrganizationId
const repositoryId = 'repo-1'
const tenantDbPath = path.join(testDir, `tenant_${orgId}.db`)

function setupTenantDb() {
  const db = new SQLite(tenantDbPath)
  db.exec(`
    CREATE TABLE integrations (
      id text NOT NULL PRIMARY KEY,
      provider text NOT NULL,
      method text NOT NULL,
      private_token text NULL
    );
    CREATE TABLE repositories (
      id text NOT NULL PRIMARY KEY,
      integration_id text NOT NULL,
      provider text NOT NULL,
      owner text NOT NULL,
      repo text NOT NULL,
      release_detection_method text NOT NULL DEFAULT 'branch',
      release_detection_key text NOT NULL DEFAULT 'production',
      updated_at datetime NOT NULL,
      created_at datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (integration_id) REFERENCES integrations(id)
    );
    CREATE TABLE github_raw_data (
      repository_id text NOT NULL,
      pull_request_number integer NOT NULL,
      pull_request text NOT NULL,
      commits text NOT NULL,
      reviews text NOT NULL,
      discussions text NOT NULL,
      timeline_items text NULL,
      fetched_at datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      PRIMARY KEY (repository_id, pull_request_number),
      FOREIGN KEY (repository_id) REFERENCES repositories(id)
    );
    CREATE TABLE github_raw_tags (
      repository_id text NOT NULL,
      tags text NOT NULL,
      fetched_at datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      PRIMARY KEY (repository_id),
      FOREIGN KEY (repository_id) REFERENCES repositories(id)
    );
  `)
  db.prepare(
    'INSERT INTO integrations (id, provider, method, private_token) VALUES (?, ?, ?, ?)',
  ).run('int-1', 'github', 'token', 'test-token')
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
  url: `https://github.com/test-owner/test-repo/pull/${number}`,
  author: 'user1',
  assignees: [],
  reviewers: [{ login: 'reviewer1', requestedAt: '2024-01-01T06:00:00Z' }],
  draft: false,
  sourceBranch: 'feature',
  targetBranch: 'main',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  mergedAt: '2024-01-02T00:00:00Z',
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

    await store.savePrData(pr, {
      commits,
      reviews,
      discussions,
      timelineItems,
    })

    expect(await store.loader.pullrequests()).toEqual([pr])
    expect(await store.loader.commits(1)).toEqual(commits)
    expect(await store.loader.reviews(1)).toEqual(reviews)
    expect(await store.loader.discussions(1)).toEqual(discussions)
    expect(await store.loader.timelineItems(1)).toEqual(timelineItems)
  })

  test('savePrData upserts on conflict', async () => {
    const store = createStore({ organizationId: orgId, repositoryId })
    const pr = makePr(1)

    await store.savePrData(pr, {
      commits: makeCommits(1),
      reviews: makeReviews(1),
      discussions: makeDiscussions(1),
    })

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

    await store.savePrData(updatedPr, {
      commits: updatedCommits,
      reviews: makeReviews(1),
      discussions: makeDiscussions(1),
    })

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

    await store.savePrData(pr, {
      commits: makeCommits(1),
      reviews: makeReviews(1),
      discussions: makeDiscussions(1),
    })

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
      await store.savePrData(makePr(n), {
        commits: makeCommits(n),
        reviews: makeReviews(n),
        discussions: makeDiscussions(n),
      })
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

    await store.savePrData(makePr(1), {
      commits: makeCommits(1),
      reviews: makeReviews(1),
      discussions: makeDiscussions(1),
    })
    await store.savePrData(makePr(2), {
      commits: makeCommits(2),
      reviews: makeReviews(2),
      discussions: makeDiscussions(2),
    })

    expect(await store.loader.pullrequests()).toHaveLength(2)
    expect(await store.loader.commits(1)).toEqual(makeCommits(1))
    expect(await store.loader.commits(2)).toEqual(makeCommits(2))
  })
})
