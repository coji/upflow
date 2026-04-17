import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export type PrTitleFilterRow = {
  id: string
  pattern: string
  normalizedPattern: string
  isEnabled: boolean
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

/** 設定画面用の一覧 (enabled / disabled 両方、created_at 昇順) */
export const listPrTitleFilters = async (
  organizationId: OrganizationId,
): Promise<PrTitleFilterRow[]> => {
  const tenantDb = getTenantDb(organizationId)
  const rows = await tenantDb
    .selectFrom('prTitleFilters')
    .select([
      'id',
      'pattern',
      'normalizedPattern',
      'isEnabled',
      'createdBy',
      'updatedBy',
      'createdAt',
      'updatedAt',
    ])
    .orderBy('createdAt', 'asc')
    .execute()
  return rows.map((row) => ({ ...row, isEnabled: Boolean(row.isEnabled) }))
}

/** loader が query 組み込みで使う enabled パターンの normalizedPattern 配列 */
export const listEnabledPrTitleFilterPatterns = async (
  organizationId: OrganizationId,
): Promise<string[]> => {
  const tenantDb = getTenantDb(organizationId)
  const rows = await tenantDb
    .selectFrom('prTitleFilters')
    .select('normalizedPattern')
    .where('isEnabled', '=', 1)
    .execute()
  return rows.map((row) => row.normalizedPattern)
}

/** Sheet プレビュー用の直近 PR タイトル一覧 */
export const listRecentPullRequestTitles = async (
  organizationId: OrganizationId,
  sinceDays = 90,
): Promise<{ repositoryId: string; number: number; title: string }[]> => {
  const tenantDb = getTenantDb(organizationId)
  const cutoff = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000,
  ).toISOString()
  return await tenantDb
    .selectFrom('pullRequests')
    .select(['repositoryId', 'number', 'title'])
    .where('pullRequestCreatedAt', '>=', cutoff)
    .orderBy('pullRequestCreatedAt', 'desc')
    .execute()
}
