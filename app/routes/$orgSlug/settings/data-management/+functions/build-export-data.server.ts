import { getTenantRawDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export interface ExportRow {
  repo: string
  number: number
  title: string
  url: string
  state: string
  author: string
  source_branch: string
  target_branch: string
  first_committed_at: string | null
  pull_request_created_at: string
  first_reviewed_at: string | null
  merged_at: string | null
  closed_at: string | null
  released_at: string | null
  coding_time: number | null
  pickup_time: number | null
  review_time: number | null
  deploy_time: number | null
  total_time: number | null
  additions: number | null
  deletions: number | null
  changed_files: number | null
  complexity: string | null
  complexity_reason: string | null
  corrected_complexity: string | null
  author_display_name: string | null
  author_is_active: number | null
  author_is_bot: number | null
  team_name: string | null
  reviewers: string
  raw_pull_request?: string | null
  raw_commits?: string | null
  raw_reviews?: string | null
  raw_discussions?: string | null
  raw_timeline_items?: string | null
}

const BASE_SELECT = `
SELECT
  r.owner || '/' || r.repo AS repo,
  pr.number, pr.title, pr.url, pr.state, pr.author,
  pr.source_branch, pr.target_branch,
  pr.first_committed_at, pr.pull_request_created_at,
  pr.first_reviewed_at, pr.merged_at, pr.closed_at, pr.released_at,
  pr.coding_time, pr.pickup_time, pr.review_time,
  pr.deploy_time, pr.total_time,
  pr.additions, pr.deletions, pr.changed_files,
  pr.complexity, pr.complexity_reason,
  pf.corrected_complexity,
  gu.display_name AS author_display_name,
  gu.is_active AS author_is_active,
  (CASE WHEN gu.type = 'Bot' THEN 1 ELSE 0 END) AS author_is_bot,
  t.name AS team_name,
  (SELECT json_group_array(json_object(
    'login', rv.reviewer,
    'display_name', COALESCE(rgu.display_name, rv.reviewer),
    'is_bot', (CASE WHEN rgu.type = 'Bot' THEN 1 ELSE 0 END),
    'requested_at', prr.requested_at,
    'reviewed_at', rv.submitted_at,
    'state', rv.state
  ))
  FROM pull_request_reviews rv
  LEFT JOIN company_github_users rgu ON LOWER(rv.reviewer) = LOWER(rgu.login)
  LEFT JOIN pull_request_reviewers prr
    ON prr.pull_request_number = rv.pull_request_number
    AND prr.repository_id = rv.repository_id
    AND prr.reviewer = rv.reviewer
  WHERE rv.pull_request_number = pr.number
    AND rv.repository_id = pr.repository_id
  ) AS reviewers`

const RAW_SELECT = `,
  grd.pull_request AS raw_pull_request,
  grd.commits AS raw_commits,
  grd.reviews AS raw_reviews,
  grd.discussions AS raw_discussions,
  grd.timeline_items AS raw_timeline_items`

const FROM_CLAUSE = `
FROM pull_requests pr
INNER JOIN repositories r ON pr.repository_id = r.id
LEFT JOIN company_github_users gu ON LOWER(pr.author) = LOWER(gu.login)
LEFT JOIN pull_request_feedbacks pf
  ON pf.pull_request_number = pr.number AND pf.repository_id = pr.repository_id
LEFT JOIN teams t ON r.team_id = t.id`

const RAW_JOIN = `
LEFT JOIN github_raw_data grd
  ON grd.pull_request_number = pr.number AND grd.repository_id = pr.repository_id`

const ORDER_BY = `
ORDER BY pr.pull_request_created_at DESC`

/**
 * Returns a lazy iterator over export rows from the tenant DB.
 * Uses better-sqlite3's `.iterate()` to avoid loading all rows into memory.
 */
export function iterateExportRows(
  organizationId: OrganizationId,
  options: { includeRaw?: boolean } = {},
): IterableIterator<ExportRow> {
  const db = getTenantRawDb(organizationId)

  const sql = options.includeRaw
    ? BASE_SELECT + RAW_SELECT + FROM_CLAUSE + RAW_JOIN + ORDER_BY
    : BASE_SELECT + FROM_CLAUSE + ORDER_BY

  return db.prepare(sql).iterate() as IterableIterator<ExportRow>
}
