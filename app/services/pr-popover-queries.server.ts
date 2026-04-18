import type {
  PRPopoverData,
  PRReviewStatus,
} from '~/app/routes/$orgSlug/+components/pr-block'
import {
  buildPRReviewerStatesMap,
  classifyPRReviewStatus,
} from '~/app/routes/$orgSlug/workload/+functions/aggregate-stacks'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export async function getPullRequestForPopover(
  organizationId: OrganizationId,
  repositoryId: string,
  number: number,
): Promise<PRPopoverData | null> {
  const tenantDb = getTenantDb(organizationId)

  const prRow = await tenantDb
    .selectFrom('pullRequests')
    .leftJoin('companyGithubUsers as authorUser', (join) =>
      join.onRef(
        (eb) => eb.fn('lower', ['pullRequests.author']),
        '=',
        (eb) => eb.fn('lower', ['authorUser.login']),
      ),
    )
    .where('pullRequests.repositoryId', '=', repositoryId)
    .where('pullRequests.number', '=', number)
    .select([
      'pullRequests.number',
      'pullRequests.repo',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.author',
      'authorUser.displayName as authorDisplayName',
      'pullRequests.pullRequestCreatedAt as createdAt',
      'pullRequests.complexity',
    ])
    .executeTakeFirst()

  if (!prRow) return null

  const [reviewHistory, reviewerRows] = await Promise.all([
    tenantDb
      .selectFrom('pullRequestReviews')
      .leftJoin('companyGithubUsers', (join) =>
        join.onRef(
          (eb) => eb.fn('lower', ['pullRequestReviews.reviewer']),
          '=',
          (eb) => eb.fn('lower', ['companyGithubUsers.login']),
        ),
      )
      .where('pullRequestReviews.repositoryId', '=', repositoryId)
      .where('pullRequestReviews.pullRequestNumber', '=', number)
      .select([
        'pullRequestReviews.pullRequestNumber as number',
        'pullRequestReviews.repositoryId',
        'pullRequestReviews.reviewer',
        'pullRequestReviews.state',
        'pullRequestReviews.submittedAt',
        'companyGithubUsers.displayName as reviewerDisplayName',
      ])
      .execute(),
    tenantDb
      .selectFrom('pullRequestReviewers')
      .leftJoin('companyGithubUsers', (join) =>
        join.onRef(
          (eb) => eb.fn('lower', ['pullRequestReviewers.reviewer']),
          '=',
          (eb) => eb.fn('lower', ['companyGithubUsers.login']),
        ),
      )
      .where('pullRequestReviewers.repositoryId', '=', repositoryId)
      .where('pullRequestReviewers.pullRequestNumber', '=', number)
      .where('pullRequestReviewers.requestedAt', 'is not', null)
      .select([
        'pullRequestReviewers.pullRequestNumber as number',
        'pullRequestReviewers.repositoryId',
        'pullRequestReviewers.reviewer',
        'companyGithubUsers.displayName as reviewerDisplayName',
      ])
      .execute(),
  ])

  const prKey = `${repositoryId}:${number}`
  const reviewerStatesByPR = buildPRReviewerStatesMap(
    reviewHistory,
    reviewerRows,
  )
  const reviewerStates = reviewerStatesByPR.get(prKey) ?? []
  const hasPendingReviewer = reviewerRows.length > 0
  const reviewStatus: PRReviewStatus = classifyPRReviewStatus(
    hasPendingReviewer,
    reviewerStates,
    prRow.author,
  )

  return {
    number: prRow.number,
    repo: prRow.repo,
    title: prRow.title,
    url: prRow.url,
    createdAt: prRow.createdAt,
    complexity: prRow.complexity,
    author: prRow.author,
    authorDisplayName: prRow.authorDisplayName,
    reviewStatus,
    reviewerStates,
  }
}
