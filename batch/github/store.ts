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

/**
 * The fetchedAt for a new write: now, but always later than the row's current
 * value, so that every landed write changes fetchedAt. process-work-set relies
 * on that, and so does the next save's check.
 */
export const nextFetchedAt = (now: Date, current: string | null): string => {
  const stamp = now.toISOString()
  if (current === null || stamp > current) return stamp
  return new Date(Date.parse(current) + 1).toISOString()
}

export const createStore = ({
  organizationId,
  repositoryId,
}: createStoreProps) => {
  const db = getTenantDb(organizationId)

  // --- save 系 ---

  /**
   * The row's fetchedAt, or null when the PR has no row. Read it before the
   * GitHub reads and pass it to savePrData / updatePrMetadata: the save then
   * lands only if no other fetch wrote the row in between.
   */
  const getFetchedAt = async (prNumber: number): Promise<string | null> => {
    const row = await db
      .selectFrom('githubRawData')
      .select('fetchedAt')
      .where('repositoryId', '=', repositoryId)
      .where('pullRequestNumber', '=', prNumber)
      .executeTakeFirst()
    return row?.fetchedAt ?? null
  }

  /** fetchedAt of every row in the repository, by PR number. */
  const getFetchedAtByPr = async (): Promise<Map<number, string>> => {
    const rows = await db
      .selectFrom('githubRawData')
      .select(['pullRequestNumber', 'fetchedAt'])
      .where('repositoryId', '=', repositoryId)
      .execute()
    return new Map(rows.map((r) => [r.pullRequestNumber, r.fetchedAt]))
  }

  /**
   * Saves a PR's raw data, only if the row's fetchedAt is still
   * `expectedFetchedAt` (null: only if the PR has no row yet). Returns whether
   * it wrote.
   *
   * Two fetches of the same PR can overlap (a PR page refresh during a crawl,
   * or two durably workers). Neither a timestamp taken before nor after the
   * GitHub reads tells which copy is newer, because the reads of one fetch
   * are six requests that can interleave with the other's. Saving only over
   * the row the fetch saw before its reads does: a fetch that started its
   * reads after another fetch saved cannot have read older data than it.
   * The caller treats a refused save as a failed fetch, so a sweep keeps its
   * watermark and lists the PR again. Checked by the TLA+ model in
   * verification/crawl-watermark.
   */
  const savePrData = async (
    pr: ShapedGitHubPullRequest,
    data: {
      commits: ShapedGitHubCommit[]
      reviews: ShapedGitHubReview[]
      discussions: ShapedGitHubReviewComment[]
      timelineItems?: ShapedTimelineItem[]
    },
    expectedFetchedAt: string | null,
    now: Date = new Date(),
  ): Promise<boolean> => {
    const fetchedAt = nextFetchedAt(now, expectedFetchedAt)
    const result = await db
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
      .onConflict((oc) => {
        const target = oc.columns(['repositoryId', 'pullRequestNumber'])
        if (expectedFetchedAt === null) return target.doNothing()
        return target
          .doUpdateSet((eb) => ({
            pullRequest: eb.ref('excluded.pullRequest'),
            commits: eb.ref('excluded.commits'),
            reviews: eb.ref('excluded.reviews'),
            discussions: eb.ref('excluded.discussions'),
            timelineItems: eb.ref('excluded.timelineItems'),
            updatedAt: eb.ref('excluded.updatedAt'),
            fetchedAt: eb.ref('excluded.fetchedAt'),
          }))
          .where('githubRawData.fetchedAt', '=', expectedFetchedAt)
      })
      .executeTakeFirst()
    return (result.numInsertedOrUpdatedRows ?? 0n) > 0n
  }

  /**
   * PR メタデータ（pullRequest JSON）だけを更新する。
   * commits/reviews 等はそのまま残る。
   * 既に raw データがある PR のみ更新し、ない PR は無視する。
   * savePrData と同じく、行の fetchedAt が expectedFetchedAt のままのときだけ書く。
   */
  const updatePrMetadata = async (
    items: Array<{ pr: ShapedGitHubPullRequest; expectedFetchedAt: string }>,
    now: Date = new Date(),
  ) => {
    let updated = 0
    for (const { pr, expectedFetchedAt } of items) {
      const result = await db
        .updateTable('githubRawData')
        .set({
          pullRequest: JSON.stringify(pr),
          updatedAt: pr.updatedAt ?? null,
          fetchedAt: nextFetchedAt(now, expectedFetchedAt),
        })
        .where('repositoryId', '=', repositoryId)
        .where('pullRequestNumber', '=', pr.number)
        .where('fetchedAt', '=', expectedFetchedAt)
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
    getFetchedAt,
    getFetchedAtByPr,
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
