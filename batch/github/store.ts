import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import type {
  ShapedGitHubCommit,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
  ShapedTimelineItem,
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
      timelineItems?: ShapedTimelineItem[]
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
        timelineItems: data.timelineItems
          ? JSON.stringify(data.timelineItems)
          : null,
      })
      .onConflict((oc) =>
        oc.columns(['repositoryId', 'pullRequestNumber']).doUpdateSet((eb) => ({
          pullRequest: eb.ref('excluded.pullRequest'),
          commits: eb.ref('excluded.commits'),
          reviews: eb.ref('excluded.reviews'),
          discussions: eb.ref('excluded.discussions'),
          timelineItems: eb.ref('excluded.timelineItems'),
        })),
      )
      .execute()
  }

  /**
   * PR メタデータ（pullRequest JSON）だけを更新する。
   * commits/reviews 等はそのまま残る。
   * 既に raw データがある PR のみ更新し、ない PR は無視する。
   */
  const updatePrMetadata = async (prs: ShapedGitHubPullRequest[]) => {
    let updated = 0
    for (const pr of prs) {
      const result = await db
        .updateTable('githubRawData')
        .set({ pullRequest: JSON.stringify(pr) })
        .where('repositoryId', '=', repositoryId)
        .where('pullRequestNumber', '=', pr.number)
        .execute()
      if (result[0].numUpdatedRows > 0n) {
        updated++
      }
    }
    return updated
  }

  const saveTags = async (tags: ShapedGitHubTag[]) => {
    await db
      .insertInto('githubRawTags')
      .values({
        repositoryId,
        tags: JSON.stringify(tags),
      })
      .onConflict((oc) =>
        oc.columns(['repositoryId']).doUpdateSet((eb) => ({
          tags: eb.ref('excluded.tags'),
        })),
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
      timelineItems: ShapedTimelineItem[]
    }
  > | null = null

  const parseRow = (row: {
    pullRequest: unknown
    commits: unknown
    reviews: unknown
    discussions: unknown
    timelineItems?: unknown
  }) => ({
    pullRequest: row.pullRequest as ShapedGitHubPullRequest,
    commits: row.commits as ShapedGitHubCommit[],
    reviews: row.reviews as ShapedGitHubReview[],
    discussions: row.discussions as ShapedGitHubReviewComment[],
    timelineItems: (row.timelineItems as ShapedTimelineItem[] | null) ?? [],
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
        'timelineItems',
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
      .select([
        'pullRequest',
        'commits',
        'reviews',
        'discussions',
        'timelineItems',
      ])
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

  const timelineItems = async (
    number: number,
  ): Promise<ShapedTimelineItem[]> => {
    const row = await loadRow(number)
    return row?.timelineItems ?? []
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
    // ParseJSONResultsPlugin が TEXT → object に自動パース済み
    return rows.map((row) => row.pullRequest as ShapedGitHubPullRequest)
  }

  const tags = async (): Promise<ShapedGitHubTag[]> => {
    const row = await db
      .selectFrom('githubRawTags')
      .select('tags')
      .where('repositoryId', '=', repositoryId)
      .executeTakeFirst()
    // ParseJSONResultsPlugin が TEXT → object に自動パース済み
    return row ? (row.tags as ShapedGitHubTag[]) : []
  }

  return {
    savePrData,
    updatePrMetadata,
    saveTags,
    preloadAll,
    loader: {
      commits,
      discussions,
      reviews,
      pullrequests,
      tags,
      timelineItems,
    },
  }
}
