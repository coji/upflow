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

/** Raw row from better-sqlite3 (no JSON parsing, snake_case columns) */
interface RawRow {
  pull_request: string
  commits: string
  reviews: string
  discussions: string
  timeline_items: string | null
}

/** Parsed row with typed data */
interface ParsedRow {
  pullRequest: ShapedGitHubPullRequest
  commits: ShapedGitHubCommit[]
  reviews: ShapedGitHubReview[]
  discussions: ShapedGitHubReviewComment[]
  timelineItems: ShapedTimelineItem[]
}

function parseRawRow(raw: RawRow): ParsedRow {
  return {
    pullRequest: JSON.parse(raw.pull_request) as ShapedGitHubPullRequest,
    commits: JSON.parse(raw.commits) as ShapedGitHubCommit[],
    reviews: JSON.parse(raw.reviews) as ShapedGitHubReview[],
    discussions: JSON.parse(raw.discussions) as ShapedGitHubReviewComment[],
    timelineItems: raw.timeline_items
      ? (JSON.parse(raw.timeline_items) as ShapedTimelineItem[])
      : [],
  }
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
        updatedAt: pr.updatedAt ?? null,
      })
      .onConflict((oc) =>
        oc.columns(['repositoryId', 'pullRequestNumber']).doUpdateSet((eb) => ({
          pullRequest: eb.ref('excluded.pullRequest'),
          commits: eb.ref('excluded.commits'),
          reviews: eb.ref('excluded.reviews'),
          discussions: eb.ref('excluded.discussions'),
          timelineItems: eb.ref('excluded.timelineItems'),
          updatedAt: eb.ref('excluded.updatedAt'),
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
        .set({
          pullRequest: JSON.stringify(pr),
          updatedAt: pr.updatedAt ?? null,
        })
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

  // Lazy parsing: raw strings are stored on preload, parsed on access
  let preloaded: Map<number, RawRow> | null = null
  // Cache parsed rows to avoid re-parsing
  let parsedCache: Map<number, ParsedRow> | null = null

  const preloadAll = () => {
    // Use raw better-sqlite3 to bypass ParseJSONResultsPlugin
    // This avoids synchronous JSON.parse of all rows at once
    const rawDb = getTenantRawDb(organizationId)
    const rows = rawDb
      .prepare(
        `SELECT pull_request_number, pull_request, commits, reviews, discussions, timeline_items
         FROM github_raw_data
         WHERE repository_id = ?`,
      )
      .all(repositoryId) as Array<RawRow & { pull_request_number: number }>

    preloaded = new Map(
      rows.map((row) => [
        row.pull_request_number,
        {
          pull_request: row.pull_request,
          commits: row.commits,
          reviews: row.reviews,
          discussions: row.discussions,
          timeline_items: row.timeline_items,
        },
      ]),
    )
    parsedCache = new Map()
  }

  // --- loader 系 ---

  const loadRow = async (number: number) => {
    if (preloaded) {
      // Check parsed cache first
      const cached = parsedCache?.get(number)
      if (cached) return cached

      const raw = preloaded.get(number)
      if (!raw) return null

      const parsed = parseRawRow(raw)
      parsedCache?.set(number, parsed)
      return parsed
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
    return {
      pullRequest: row.pullRequest as ShapedGitHubPullRequest,
      commits: row.commits as ShapedGitHubCommit[],
      reviews: row.reviews as ShapedGitHubReview[],
      discussions: row.discussions as ShapedGitHubReviewComment[],
      timelineItems: (row.timelineItems as ShapedTimelineItem[] | null) ?? [],
    }
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
      // Only parse pullRequest field, not commits/reviews/etc.
      return [...preloaded.values()].map(
        (raw) => JSON.parse(raw.pull_request) as ShapedGitHubPullRequest,
      )
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
   * Get the latest updatedAt timestamp for this repository.
   * Uses SQL MAX() — no JSON parsing needed.
   */
  const getLatestUpdatedAt = async (): Promise<string | null> => {
    const row = await db
      .selectFrom('githubRawData')
      .select((eb) => eb.fn.max('updatedAt').as('maxUpdatedAt'))
      .where('repositoryId', '=', repositoryId)
      .executeTakeFirst()
    return (row?.maxUpdatedAt as string | null) ?? null
  }

  return {
    savePrData,
    updatePrMetadata,
    saveTags,
    preloadAll,
    getLatestUpdatedAt,
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
