import {
  type OrganizationId,
  getTenantDb,
} from '~/app/services/tenant-db.server'
import type {
  ShapedGitHubCommit,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
} from './model'

interface createStoreProps {
  organizationId: OrganizationId
  repositoryId: string
}

export const createStore = ({
  organizationId,
  repositoryId,
}: createStoreProps) => {
  const db = getTenantDb(organizationId)

  // --- save 系 ---

  const savePrData = async (
    pr: ShapedGitHubPullRequest,
    data: {
      commits: ShapedGitHubCommit[]
      reviews: ShapedGitHubReview[]
      discussions: ShapedGitHubReviewComment[]
    },
  ) => {
    await db
      .insertInto('githubRawData')
      .values({
        repositoryId,
        pullRequestNumber: pr.number,
        pullRequest: JSON.stringify(pr),
        commits: JSON.stringify(data.commits),
        reviews: JSON.stringify(data.reviews),
        discussions: JSON.stringify(data.discussions),
      })
      .onConflict((oc) =>
        oc.columns(['repositoryId', 'pullRequestNumber']).doUpdateSet({
          pullRequest: JSON.stringify(pr),
          commits: JSON.stringify(data.commits),
          reviews: JSON.stringify(data.reviews),
          discussions: JSON.stringify(data.discussions),
        }),
      )
      .execute()
  }

  const saveTags = async (tags: ShapedGitHubTag[]) => {
    await db
      .insertInto('githubRawTags')
      .values({
        repositoryId,
        tags: JSON.stringify(tags),
      })
      .onConflict((oc) =>
        oc.columns(['repositoryId']).doUpdateSet({
          tags: JSON.stringify(tags),
        }),
      )
      .execute()
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

  const parseRow = (row: {
    pullRequest: unknown
    commits: unknown
    reviews: unknown
    discussions: unknown
  }) => ({
    pullRequest: row.pullRequest as ShapedGitHubPullRequest,
    commits: row.commits as ShapedGitHubCommit[],
    reviews: row.reviews as ShapedGitHubReview[],
    discussions: row.discussions as ShapedGitHubReviewComment[],
  })

  const preloadAll = async () => {
    const rows = await db
      .selectFrom('githubRawData')
      .select([
        'pullRequestNumber',
        'pullRequest',
        'commits',
        'reviews',
        'discussions',
      ])
      .where('repositoryId', '=', repositoryId)
      .execute()

    preloaded = new Map(
      rows.map((row) => [row.pullRequestNumber, parseRow(row)]),
    )
  }

  // --- loader 系 ---

  const loadRow = async (number: number) => {
    if (preloaded) {
      return preloaded.get(number) ?? null
    }
    const row = await db
      .selectFrom('githubRawData')
      .select(['pullRequest', 'commits', 'reviews', 'discussions'])
      .where('repositoryId', '=', repositoryId)
      .where('pullRequestNumber', '=', number)
      .executeTakeFirst()
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
    const rows = await db
      .selectFrom('githubRawData')
      .select('pullRequest')
      .where('repositoryId', '=', repositoryId)
      .execute()
    return rows.map(
      (row) => row.pullRequest as unknown as ShapedGitHubPullRequest,
    )
  }

  const tags = async (): Promise<ShapedGitHubTag[]> => {
    const row = await db
      .selectFrom('githubRawTags')
      .select('tags')
      .where('repositoryId', '=', repositoryId)
      .executeTakeFirst()
    return row ? (row.tags as unknown as ShapedGitHubTag[]) : []
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
