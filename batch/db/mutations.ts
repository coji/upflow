import type { Insertable, Selectable } from 'kysely'
import { setImmediate as yieldToEventLoop } from 'node:timers/promises'
import { getTenantDb, type TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import type { AnalyzedReview, AnalyzedReviewer } from '../github/types'
import { logger } from '../helper/logger'

export function upsertPullRequest(
  organizationId: OrganizationId,
  data: Insertable<TenantDB.PullRequests>,
) {
  const tenantDb = getTenantDb(organizationId)
  return tenantDb
    .insertInto('pullRequests')
    .values(data)
    .onConflict((oc) =>
      oc.columns(['repositoryId', 'number']).doUpdateSet((eb) => ({
        repo: eb.ref('excluded.repo'),
        author: eb.ref('excluded.author'),
        title: eb.ref('excluded.title'),
        url: eb.ref('excluded.url'),
        state: eb.ref('excluded.state'),
        targetBranch: eb.ref('excluded.targetBranch'),
        sourceBranch: eb.ref('excluded.sourceBranch'),
        mergedAt: eb.ref('excluded.mergedAt'),
        closedAt: eb.ref('excluded.closedAt'),
        releasedAt: eb.ref('excluded.releasedAt'),
        firstCommittedAt: eb.ref('excluded.firstCommittedAt'),
        pullRequestCreatedAt: eb.ref('excluded.pullRequestCreatedAt'),
        firstReviewedAt: eb.ref('excluded.firstReviewedAt'),
        codingTime: eb.ref('excluded.codingTime'),
        pickupTime: eb.ref('excluded.pickupTime'),
        reviewTime: eb.ref('excluded.reviewTime'),
        deployTime: eb.ref('excluded.deployTime'),
        totalTime: eb.ref('excluded.totalTime'),
        updatedAt: eb.ref('excluded.updatedAt'),
        additions: eb.ref('excluded.additions'),
        deletions: eb.ref('excluded.deletions'),
        changedFiles: eb.ref('excluded.changedFiles'),
      })),
    )
    .executeTakeFirst()
}

export function upsertPullRequestReview(
  organizationId: OrganizationId,
  data: Insertable<TenantDB.PullRequestReviews>,
) {
  const tenantDb = getTenantDb(organizationId)
  return tenantDb
    .insertInto('pullRequestReviews')
    .values(data)
    .onConflict((oc) =>
      oc.column('id').doUpdateSet((eb) => ({
        state: eb.ref('excluded.state'),
        url: eb.ref('excluded.url'),
        reviewer: eb.ref('excluded.reviewer'),
        submittedAt: eb.ref('excluded.submittedAt'),
      })),
    )
    .executeTakeFirst()
}

export async function batchUpsertPullRequests(
  organizationId: OrganizationId,
  rows: Insertable<TenantDB.PullRequests>[],
  chunkSize = 20,
) {
  if (rows.length === 0) return
  const tenantDb = getTenantDb(organizationId)

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)

    await tenantDb
      .insertInto('pullRequests')
      .values(chunk)
      .onConflict((oc) =>
        oc.columns(['repositoryId', 'number']).doUpdateSet((eb) => ({
          repo: eb.ref('excluded.repo'),
          author: eb.ref('excluded.author'),
          title: eb.ref('excluded.title'),
          url: eb.ref('excluded.url'),
          state: eb.ref('excluded.state'),
          targetBranch: eb.ref('excluded.targetBranch'),
          sourceBranch: eb.ref('excluded.sourceBranch'),
          mergedAt: eb.ref('excluded.mergedAt'),
          closedAt: eb.ref('excluded.closedAt'),
          releasedAt: eb.ref('excluded.releasedAt'),
          firstCommittedAt: eb.ref('excluded.firstCommittedAt'),
          pullRequestCreatedAt: eb.ref('excluded.pullRequestCreatedAt'),
          firstReviewedAt: eb.ref('excluded.firstReviewedAt'),
          codingTime: eb.ref('excluded.codingTime'),
          pickupTime: eb.ref('excluded.pickupTime'),
          reviewTime: eb.ref('excluded.reviewTime'),
          deployTime: eb.ref('excluded.deployTime'),
          totalTime: eb.ref('excluded.totalTime'),
          updatedAt: eb.ref('excluded.updatedAt'),
          additions: eb.ref('excluded.additions'),
          deletions: eb.ref('excluded.deletions'),
          changedFiles: eb.ref('excluded.changedFiles'),
        })),
      )
      .execute()

    await yieldToEventLoop()
  }
}

export async function batchUpsertPullRequestReviews(
  organizationId: OrganizationId,
  rows: Insertable<TenantDB.PullRequestReviews>[],
  chunkSize = 50,
) {
  if (rows.length === 0) return
  const tenantDb = getTenantDb(organizationId)

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await tenantDb
      .insertInto('pullRequestReviews')
      .values(chunk)
      .onConflict((oc) =>
        oc.column('id').doUpdateSet((eb) => ({
          state: eb.ref('excluded.state'),
          url: eb.ref('excluded.url'),
          reviewer: eb.ref('excluded.reviewer'),
          submittedAt: eb.ref('excluded.submittedAt'),
        })),
      )
      .execute()

    await yieldToEventLoop()
  }
}

export async function upsertPullRequestReviewers(
  organizationId: OrganizationId,
  repositoryId: string,
  pullRequestNumber: number,
  reviewers: { login: string; requestedAt: string | null }[],
) {
  const tenantDb = getTenantDb(organizationId)
  await tenantDb.transaction().execute(async (trx) => {
    // 既存のレビュー依頼を削除してから再挿入（スナップショット方式）
    await trx
      .deleteFrom('pullRequestReviewers')
      .where('repositoryId', '=', repositoryId)
      .where('pullRequestNumber', '=', pullRequestNumber)
      .execute()

    const seen = new Set<string>()
    const uniqueReviewers = reviewers.filter((r) => {
      if (!r.login) return false
      if (seen.has(r.login)) return false
      seen.add(r.login)
      return true
    })
    if (uniqueReviewers.length === 0) return

    await trx
      .insertInto('pullRequestReviewers')
      .values(
        uniqueReviewers.map((r) => ({
          pullRequestNumber,
          repositoryId,
          reviewer: r.login,
          requestedAt: r.requestedAt,
        })),
      )
      .execute()
  })
}

export async function batchReplacePullRequestReviewers(
  organizationId: OrganizationId,
  rows: AnalyzedReviewer[],
  chunkSize = 25,
) {
  if (rows.length === 0) return

  const tenantDb = getTenantDb(organizationId)

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await tenantDb.transaction().execute(async (trx) => {
      for (const row of chunk) {
        await trx
          .deleteFrom('pullRequestReviewers')
          .where('repositoryId', '=', row.repositoryId)
          .where('pullRequestNumber', '=', row.pullRequestNumber)
          .execute()
      }

      const values = chunk.flatMap((row) => {
        const seen = new Set<string>()
        return row.reviewers.flatMap((reviewer) => {
          if (!reviewer.login) return []
          if (seen.has(reviewer.login)) return []
          seen.add(reviewer.login)
          return [
            {
              pullRequestNumber: row.pullRequestNumber,
              repositoryId: row.repositoryId,
              reviewer: reviewer.login,
              requestedAt: reviewer.requestedAt,
            },
          ]
        })
      })

      if (values.length > 0) {
        await trx.insertInto('pullRequestReviewers').values(values).execute()
      }
    })

    await yieldToEventLoop()
  }
}

/**
 * batch で発見した GitHub ユーザーを companyGithubUsers に自動登録する。
 * isActive: 0（無効）で挿入し、既存レコードは一切上書きしない。
 */
export async function upsertCompanyGithubUsers(
  organizationId: OrganizationId,
  logins: string[],
  botUsers?: Set<string>,
) {
  if (logins.length === 0) return

  const tenantDb = getTenantDb(organizationId)
  const now = new Date().toISOString()
  const uniqueLogins = [
    ...new Set(logins.filter(Boolean).map((l) => l.toLowerCase())),
  ]

  await tenantDb
    .insertInto('companyGithubUsers')
    .values(
      uniqueLogins.map((login) => ({
        login,
        displayName: login,
        type: botUsers?.has(login) ? 'Bot' : null,
        isActive: 0,
        updatedAt: now,
      })),
    )
    .onConflict((oc) =>
      oc.column('login').doUpdateSet((eb) => ({
        // API で bot と判定されたユーザーの type を自動設定（未設定の場合のみ）
        type: eb.fn.coalesce(
          eb.ref('companyGithubUsers.type'),
          eb.ref('excluded.type'),
        ),
      })),
    )
    .execute()
  logger.info(
    `upserted ${uniqueLogins.length} company github users.`,
    organizationId,
  )
}

function trackLatest(map: Map<string, string>, login: string, ts: string) {
  const key = login.toLowerCase()
  const current = map.get(key)
  if (!current || ts > current) {
    map.set(key, ts)
  }
}

/**
 * ユーザーごとの最終活動日時を更新する。
 * 既存値より新しい場合のみ上書き。
 */
async function updateLastActivityAt(
  organizationId: OrganizationId,
  lastActivity: Map<string, string>,
) {
  if (lastActivity.size === 0) return
  const tenantDb = getTenantDb(organizationId)

  for (const [login, ts] of lastActivity) {
    await tenantDb
      .updateTable('companyGithubUsers')
      .set({ lastActivityAt: ts })
      .where('login', '=', login)
      .where((eb) =>
        eb.or([
          eb('lastActivityAt', 'is', null),
          eb('lastActivityAt', '<', ts),
        ]),
      )
      .execute()
  }
}

/**
 * analyze 結果を一括で DB に書き込む共通関数。
 * durably ジョブ（process）の共通 upsert 処理。
 */
export async function upsertAnalyzedData(
  organizationId: OrganizationId,
  data: {
    pulls: Selectable<TenantDB.PullRequests>[]
    reviews: AnalyzedReview[]
    reviewers: AnalyzedReviewer[]
    botUsers?: Set<string>
  },
) {
  // Auto-register discovered GitHub users
  const discoveredLogins = new Set<string>()
  for (const pr of data.pulls) {
    if (pr.author) discoveredLogins.add(pr.author)
  }
  for (const review of data.reviews) {
    if (review.reviewer) discoveredLogins.add(review.reviewer)
  }
  for (const reviewer of data.reviewers) {
    for (const r of reviewer.reviewers) {
      if (r.login) discoveredLogins.add(r.login)
    }
  }
  await upsertCompanyGithubUsers(
    organizationId,
    [...discoveredLogins],
    data.botUsers,
  )

  // Update last activity timestamps
  const lastActivity = new Map<string, string>()
  for (const pr of data.pulls) {
    if (pr.author) trackLatest(lastActivity, pr.author, pr.pullRequestCreatedAt)
  }
  for (const review of data.reviews) {
    if (review.reviewer)
      trackLatest(lastActivity, review.reviewer, review.submittedAt)
  }
  await updateLastActivityAt(organizationId, lastActivity)

  // Upsert pull requests
  logger.info('upsert started...', organizationId)
  await batchUpsertPullRequests(organizationId, data.pulls)
  logger.info('upsert pull requests completed.', organizationId)

  // Upsert reviews
  logger.info('upsert reviews started...', organizationId)
  await batchUpsertPullRequestReviews(
    organizationId,
    data.reviews.map((r) => ({
      id: r.id,
      pullRequestNumber: r.pullRequestNumber,
      repositoryId: r.repositoryId,
      reviewer: r.reviewer,
      state: r.state,
      submittedAt: r.submittedAt,
      url: r.url,
    })),
  )
  logger.info('upsert reviews completed.', organizationId)

  // Upsert reviewers
  logger.info('upsert reviewers started...', organizationId)
  await batchReplacePullRequestReviewers(organizationId, data.reviewers)
  logger.info('upsert reviewers completed.', organizationId)
}
