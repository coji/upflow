import consola from 'consola'
import invariant from 'tiny-invariant'
import { getCompany, getPullRequestReport } from '~/batch/db'
import { allConfigs } from '../config'
import { timeFormatTz } from '../helper/timeformat'

interface reportCommandProps {
  companyId?: string
}

export async function reportCommand({ companyId }: reportCommandProps) {
  if (!companyId) {
    consola.error('config should specified')
    consola.info(
      (await allConfigs())
        .map((c) => `${c.companyName}\t${c.companyId}`)
        .join('\n'),
    )
    return
  }

  const company = await getCompany(companyId)
  invariant(company.integration, 'integration should related')

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

  const prList = await getPullRequestReport(company.id)
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
}
