import { sql } from 'kysely'
import {
  type OrganizationId,
  getTenantDbRaw,
} from '~/app/services/tenant-db.server'
import type {
  ShapedGitHubCommit,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
} from './model'

interface RawDataRow {
  pull_request_number: number
  pull_request: string
  commits: string
  reviews: string
  discussions: string
}

interface RawTagsRow {
  tags: string
}

interface createStoreProps {
  organizationId: OrganizationId
  repositoryId: string
}

export const createStore = ({
  organizationId,
  repositoryId,
}: createStoreProps) => {
  // Plugin-free DB to preserve JSON keys as-is (no CamelCase/ParseJSON transformation)
  const db = getTenantDbRaw(organizationId)

  // --- save 系 ---

  const savePrData = async (
    pr: ShapedGitHubPullRequest,
    data: {
      commits: ShapedGitHubCommit[]
      reviews: ShapedGitHubReview[]
      discussions: ShapedGitHubReviewComment[]
    },
  ) => {
    const prJson = JSON.stringify(pr)
    const commitsJson = JSON.stringify(data.commits)
    const reviewsJson = JSON.stringify(data.reviews)
    const discussionsJson = JSON.stringify(data.discussions)

    await sql`
      INSERT INTO github_raw_data (repository_id, pull_request_number, pull_request, commits, reviews, discussions)
      VALUES (${repositoryId}, ${pr.number}, ${prJson}, ${commitsJson}, ${reviewsJson}, ${discussionsJson})
      ON CONFLICT (repository_id, pull_request_number) DO UPDATE SET
        pull_request = ${prJson},
        commits = ${commitsJson},
        reviews = ${reviewsJson},
        discussions = ${discussionsJson},
        fetched_at = datetime('now')
    `.execute(db)
  }

  const saveTags = async (tags: ShapedGitHubTag[]) => {
    const tagsJson = JSON.stringify(tags)

    await sql`
      INSERT INTO github_raw_tags (repository_id, tags)
      VALUES (${repositoryId}, ${tagsJson})
      ON CONFLICT (repository_id) DO UPDATE SET
        tags = ${tagsJson},
        fetched_at = datetime('now')
    `.execute(db)
  }

  // --- preload 系 (analyze 用の一括ロード) ---

  let preloaded: Map<
    number,
    {
      pullRequest: ShapedGitHubPullRequest
      commits: ShapedGitHubCommit[]
      reviews: ShapedGitHubReview[]
      discussions: ShapedGitHubReviewComment[]
    }
  > | null = null

  const parseRow = (row: RawDataRow) => ({
    pullRequest: JSON.parse(row.pull_request) as ShapedGitHubPullRequest,
    commits: JSON.parse(row.commits) as ShapedGitHubCommit[],
    reviews: JSON.parse(row.reviews) as ShapedGitHubReview[],
    discussions: JSON.parse(row.discussions) as ShapedGitHubReviewComment[],
  })

  const preloadAll = async () => {
    const result = await sql<RawDataRow>`
      SELECT pull_request_number, pull_request, commits, reviews, discussions
      FROM github_raw_data
      WHERE repository_id = ${repositoryId}
    `.execute(db)

    preloaded = new Map(
      result.rows.map((row) => [row.pull_request_number, parseRow(row)]),
    )
  }

  // --- loader 系 ---

  const loadRow = async (number: number) => {
    if (preloaded) {
      return preloaded.get(number) ?? null
    }
    const result = await sql<RawDataRow>`
      SELECT pull_request, commits, reviews, discussions
      FROM github_raw_data
      WHERE repository_id = ${repositoryId} AND pull_request_number = ${number}
    `.execute(db)
    const row = result.rows[0]
    if (!row) return null
    return parseRow(row)
  }

  const commits = async (number: number) => {
    const row = await loadRow(number)
    return row?.commits ?? []
  }

  const reviews = async (number: number) => {
    const row = await loadRow(number)
    return row?.reviews ?? []
  }

  const discussions = async (number: number) => {
    const row = await loadRow(number)
    return row?.discussions ?? []
  }

  const pullrequests = async (): Promise<ShapedGitHubPullRequest[]> => {
    if (preloaded) {
      return [...preloaded.values()].map((v) => v.pullRequest)
    }
    const result = await sql<Pick<RawDataRow, 'pull_request'>>`
      SELECT pull_request
      FROM github_raw_data
      WHERE repository_id = ${repositoryId}
    `.execute(db)
    return result.rows.map(
      (row) => JSON.parse(row.pull_request) as ShapedGitHubPullRequest,
    )
  }

  const tags = async (): Promise<ShapedGitHubTag[]> => {
    const result = await sql<RawTagsRow>`
      SELECT tags
      FROM github_raw_tags
      WHERE repository_id = ${repositoryId}
    `.execute(db)
    const row = result.rows[0]
    return row ? (JSON.parse(row.tags) as ShapedGitHubTag[]) : []
  }

  return {
    savePrData,
    saveTags,
    preloadAll,
    loader: {
      commits,
      discussions,
      reviews,
      pullrequests,
      tags,
    },
  }
}
