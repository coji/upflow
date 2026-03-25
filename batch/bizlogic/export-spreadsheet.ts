import type { Selectable } from 'kysely'
import { createSheetApi } from '~/app/services/sheets.server'
import type { TenantDB } from '~/app/services/tenant-db.server'
import { timeFormatTz } from '../helper/timeformat'

const escapeTabString = (str: string) => {
  return str.replaceAll('\t', '\\t')
}

const tz = 'Asia/Tokyo'

interface ExportPullRequest {
  repo: string
  number: number
  sourceBranch: string
  targetBranch: string
  state: string
  author: string
  title: string
  url: string
  codingTime: number | null
  pickupTime: number | null
  reviewTime: number | null
  deployTime: number | null
  totalTime: number | null
  firstCommittedAt: string | null
  pullRequestCreatedAt: string | null
  firstReviewedAt: string | null
  mergedAt: string | null
  releasedAt: string | null
  updatedAt: string | null
}

export async function exportPulls(
  exportSetting: Selectable<TenantDB.ExportSettings>,
  pullrequests: ExportPullRequest[],
): Promise<void> {
  const sheet = createSheetApi({
    spreadsheetId: exportSetting.sheetId,
    sheetTitle: 'rawdata',
    clientEmail: exportSetting.clientEmail,
    privateKey: exportSetting.privateKey,
  })
  const header = [
    'repo',
    'number',
    'sourceBranch',
    'targetBranch',
    'state',
    'author',
    'title',
    'url',
    'codingTime',
    'pickupTime',
    'reviewTime',
    'deployTime',
    'totalTime',
    'firstCommittedAt',
    'pullRequestCreatedAt',
    'firstReviewedAt',
    'mergedAt',
    'releasedAt',
    'updatedAt',
  ].join('\t')

  const data = [
    header,
    ...pullrequests.map((pr) => {
      // １行タブ区切り x 改行区切りで全行まとめてペースト
      return Object.values({
        repo: pr.repo,
        number: pr.number,
        sourceBranch: pr.sourceBranch,
        targetBranch: pr.targetBranch,
        state: pr.state,
        author: pr.author,
        title: escapeTabString(pr.title),
        url: pr.url,
        codingTime: pr.codingTime,
        pickupTime: pr.pickupTime,
        reviewTime: pr.reviewTime,
        deployTime: pr.deployTime,
        totalTime: pr.totalTime,
        firstCommitedAt: timeFormatTz(pr.firstCommittedAt, tz), // ISO形式から YYYY-MM-DD HH:mm:ss に変換。TODO: タイムゾーン対応?
        pullRequestCreatedAt: timeFormatTz(pr.pullRequestCreatedAt, tz),
        firstReviewedAt: timeFormatTz(pr.firstReviewedAt, tz),
        mergedAt: timeFormatTz(pr.mergedAt, tz),
        releasedAt: timeFormatTz(pr.releasedAt, tz),
        updatedAt: timeFormatTz(pr.updatedAt, tz),
      }).join('\t')
    }),
  ].join('\n')

  await sheet.paste(data)
}
