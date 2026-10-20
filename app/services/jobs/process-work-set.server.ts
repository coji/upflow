/**
 * process ジョブの処理対象を raw データの状態から決める。
 *
 * `github_raw_data.processed_at` は、最後に upsert まで終えた時点の
 * `fetched_at` を記録する。`processed_at` が `fetched_at` と一致しない行が
 * 未処理 (dirty)。
 *
 * trigger input の scopes は coalesce で捨てられうる (durably は既存の
 * pending run に合流させ、後発の input を保存しない)。処理対象を DB から
 * 導出することで、どの run が走っても取りこぼしが起きない (#285)。
 */
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

/** repositoryId ごとの [prNumber, fetchedAt] のスナップショット */
export type ProcessWorkSet = Array<{
  repositoryId: string
  prs: Array<[number, string]>
}>

export async function collectProcessWorkSet(
  orgId: OrganizationId,
  options: {
    /** true なら全 raw 行を対象にする (full-org process) */
    fullOrg: boolean
    /** dirty でなくても対象に含める PR (明示指定) */
    include?: Array<{ repositoryId: string; prNumbers: number[] }>
  },
): Promise<ProcessWorkSet> {
  const tenantDb = getTenantDb(orgId)
  const rows = await tenantDb
    .selectFrom('githubRawData')
    .select(['repositoryId', 'pullRequestNumber', 'fetchedAt', 'processedAt'])
    .execute()

  const included = new Set(
    (options.include ?? []).flatMap((s) =>
      s.prNumbers.map((n) => `${s.repositoryId}#${n}`),
    ),
  )

  const byRepo = new Map<string, Array<[number, string]>>()
  for (const row of rows) {
    const isTarget =
      options.fullOrg ||
      row.processedAt !== row.fetchedAt ||
      included.has(`${row.repositoryId}#${row.pullRequestNumber}`)
    if (!isTarget) continue
    const prs = byRepo.get(row.repositoryId) ?? []
    prs.push([row.pullRequestNumber, row.fetchedAt])
    byRepo.set(row.repositoryId, prs)
  }

  return [...byRepo.entries()].map(([repositoryId, prs]) => ({
    repositoryId,
    prs,
  }))
}

/**
 * スナップショット時点の fetched_at を processed_at に記録する。
 * 処理中に再 fetch された行は fetched_at が変わっているので dirty のまま残る。
 */
export async function markProcessed(
  orgId: OrganizationId,
  workSet: ProcessWorkSet,
): Promise<void> {
  const tenantDb = getTenantDb(orgId)
  await tenantDb.transaction().execute(async (trx) => {
    for (const { repositoryId, prs } of workSet) {
      for (const [prNumber, fetchedAt] of prs) {
        await trx
          .updateTable('githubRawData')
          .set({ processedAt: fetchedAt })
          .where('repositoryId', '=', repositoryId)
          .where('pullRequestNumber', '=', prNumber)
          .where('fetchedAt', '=', fetchedAt)
          .execute()
      }
    }
  })
}
