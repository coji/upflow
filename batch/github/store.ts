import type SQLite from 'better-sqlite3'
import { getTenantDb, getTenantRawDb } from '~/app/services/tenant-db.server'
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

/** Parsed row with typed data */
interface ParsedRow {
  pullRequest: ShapedGitHubPullRequest
  commits: ShapedGitHubCommit[]
  reviews: ShapedGitHubReview[]
  discussions: ShapedGitHubReviewComment[]
  timelineItems: ShapedTimelineItem[]
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
    fetchedAt: string,
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
        updatedAt: pr.updatedAt ?? null,
        fetchedAt,
      })
      .onConflict((oc) =>
        oc
          .columns(['repositoryId', 'pullRequestNumber'])
          .doUpdateSet((eb) => ({
            pullRequest: eb.ref('excluded.pullRequest'),
            commits: eb.ref('excluded.commits'),
            reviews: eb.ref('excluded.reviews'),
            discussions: eb.ref('excluded.discussions'),
            timelineItems: eb.ref('excluded.timelineItems'),
            updatedAt: eb.ref('excluded.updatedAt'),
            fetchedAt: eb.ref('excluded.fetchedAt'),
          }))
          .whereRef('excluded.fetchedAt', '>=', 'githubRawData.fetchedAt'),
      )
      .execute()
  }

  /**
   * PR メタデータ（pullRequest JSON）だけを更新する。
   * commits/reviews 等はそのまま残る。
   * 既に raw データがある PR のみ更新し、ない PR は無視する。
   */
  const updatePrMetadata = async (
    items: Array<{ pr: ShapedGitHubPullRequest; fetchedAt: string }>,
  ) => {
    let updated = 0
    for (const { pr, fetchedAt } of items) {
      const result = await db
        .updateTable('githubRawData')
        .set({
          pullRequest: JSON.stringify(pr),
          updatedAt: pr.updatedAt ?? null,
          fetchedAt,
        })
        .where('repositoryId', '=', repositoryId)
        .where('pullRequestNumber', '=', pr.number)
        .where((eb) => eb('fetchedAt', '<=', fetchedAt))
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

  // --- preload 系 ---

  // PR metadata (pull_request JSON) is preloaded upfront.
  // Heavy columns (commits/reviews/discussions/timeline_items) are loaded
  // per-PR on demand via PK lookup to avoid parsing all JSON at once.
  let prMetadata: Map<number, ShapedGitHubPullRequest> | null = null

  // Cache for full row data loaded on demand
  const rowCache = new Map<number, ParsedRow>()

  // Cached prepared statement for per-PR heavy column lookup (lazily created)
  let loadRowStmt: SQLite.Statement | null = null

  const getLoadRowStmt = (): SQLite.Statement => {
    if (!loadRowStmt) {
      const rawDb = getTenantRawDb(organizationId)
      loadRowStmt = rawDb.prepare(
        `SELECT commits, reviews, discussions, timeline_items
         FROM github_raw_data
         WHERE repository_id = ? AND pull_request_number = ?`,
      )
    }
    return loadRowStmt
  }

  const preloadAll = (): void => {
    // Use raw better-sqlite3 to bypass ParseJSONResultsPlugin
    const rawDb = getTenantRawDb(organizationId)
    const rows = rawDb
      .prepare(
        `SELECT pull_request_number, pull_request
         FROM github_raw_data
         WHERE repository_id = ?`,
      )
      .all(repositoryId) as Array<{
      pull_request_number: number
      pull_request: string
    }>

    prMetadata = new Map(
      rows.map((row) => [
        row.pull_request_number,
        JSON.parse(row.pull_request) as ShapedGitHubPullRequest,
      ]),
    )
  }

  // --- loader 系 ---

  const loadRow = async (number: number): Promise<ParsedRow | null> => {
    const cached = rowCache.get(number)
    if (cached) return cached

    // If preloaded, we have PR metadata but need heavy columns from DB
    if (prMetadata) {
      const pr = prMetadata.get(number)
      if (!pr) return null

      // Load only heavy columns via raw DB (bypasses ParseJSONResultsPlugin)
      const row = getLoadRowStmt().get(repositoryId, number) as
        | {
            commits: string
            reviews: string
            discussions: string
            timeline_items: string | null
          }
        | undefined
      if (!row) return null

      const parsed: ParsedRow = {
        pullRequest: pr,
        commits: JSON.parse(row.commits) as ShapedGitHubCommit[],
        reviews: JSON.parse(row.reviews) as ShapedGitHubReview[],
        discussions: JSON.parse(row.discussions) as ShapedGitHubReviewComment[],
        timelineItems: row.timeline_items
          ? (JSON.parse(row.timeline_items) as ShapedTimelineItem[])
          : [],
      }
      rowCache.set(number, parsed)
      return parsed
    }

    // No preload: full query via Kysely
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
    const parsed: ParsedRow = {
      pullRequest: row.pullRequest as ShapedGitHubPullRequest,
      commits: row.commits as ShapedGitHubCommit[],
      reviews: row.reviews as ShapedGitHubReview[],
      discussions: row.discussions as ShapedGitHubReviewComment[],
      timelineItems: (row.timelineItems as ShapedTimelineItem[] | null) ?? [],
    }
    rowCache.set(number, parsed)
    return parsed
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
    if (prMetadata) {
      return [...prMetadata.values()]
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

  /**
   * Scan watermark: the upper bound (PR updatedAt) up to which a full-sweep
   * crawl has guaranteed to have fetched every PR. Only full-sweep crawls
   * should advance this; targeted fetches (webhook-driven) must NOT touch it,
   * otherwise older PRs that were updated during a gap get skipped by the
   * next full crawl's `stopBefore` check. See issue #278.
   */
  const getScanWatermark = async (): Promise<string | null> => {
    const row = await db
      .selectFrom('repositories')
      .select('scanWatermark')
      .where('id', '=', repositoryId)
      .executeTakeFirst()
    return row?.scanWatermark ?? null
  }

  const setScanWatermark = async (watermark: string): Promise<void> => {
    await db
      .updateTable('repositories')
      .set({ scanWatermark: watermark })
      .where('id', '=', repositoryId)
      .execute()
  }

  return {
    savePrData,
    updatePrMetadata,
    saveTags,
    preloadAll,
    getScanWatermark,
    setScanWatermark,
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
