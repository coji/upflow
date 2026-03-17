import invariant from 'tiny-invariant'
import { getPullRequestReport } from '~/batch/db'
import { timeFormatTz } from '../helper/timeformat'
import { requireOrganization } from './helpers'
import { shutdown } from './shutdown'

interface reportCommandProps {
  organizationId?: string
}

export async function reportCommand({ organizationId }: reportCommandProps) {
  const result = await requireOrganization(organizationId)
  if (!result) return

  const { orgId, organization } = result
  invariant(organization.integration, 'integration should related')

  console.log(
    [
      'repo',
      'number',
      'source branch',
      'target branch',
      'state',
      'author',
      'title',
      'url',
      '初回コミット日時',
      'PR作成日時',
      '初回レビュー日時',
      'マージ日時',
      'リリース日時',
      'coding time',
      'pickup time',
      'review time',
      'deploy time',
      'total time',
    ].join('\t'),
  )
  const tz = 'Asia/Tokyo'

  const prList = await getPullRequestReport(orgId)
  for (const pr of prList) {
    console.log(
      [
        pr.repo,
        pr.number,
        pr.sourceBranch,
        pr.targetBranch,
        pr.state,
        pr.author,
        pr.title,
        pr.url,
        timeFormatTz(pr.firstCommittedAt, tz),
        timeFormatTz(pr.pullRequestCreatedAt, tz),
        timeFormatTz(pr.firstReviewedAt, tz),
        timeFormatTz(pr.mergedAt, tz),
        timeFormatTz(pr.releasedAt, tz),
        pr.codingTime,
        pr.pickupTime,
        pr.reviewTime,
        pr.deployTime,
        pr.totalTime,
      ].join('\t'),
    )
  }
  await shutdown()
}
