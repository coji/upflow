import type { ExportSetting, PullRequest } from '@prisma/client'
import { createSheetApi } from '~/app/libs/sheets'
import { timeFormat } from '../helper/timeformat'
import dayjs from '~/app/libs/dayjs'

const escapeTabString = (str: string) => {
  return str.replaceAll('\t', '\\t')
}
/**
 * @param pullrequests
 * @param exportSetting
 */
export const exportPullsToSpreadsheet = async (pullrequests: PullRequest[], exportSetting: ExportSetting) => {
  const tz = 'Asia/Tokyo'
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
    ...pullrequests
      .filter((pr) => pr.updatedAt && dayjs(pr.updatedAt) > dayjs().add(-90, 'days'))
      .map((pr) => {
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
          firstCommitedAt: timeFormat(pr.firstCommittedAt, tz), // ISO形式から YYYY-MM-DD HH:mm:ss に変換。TODO: タイムゾーン対応?
          pullRequestCreatedAt: timeFormat(pr.pullRequestCreatedAt, tz),
          firstReviewedAt: timeFormat(pr.firstReviewedAt, tz),
          mergedAt: timeFormat(pr.mergedAt, tz),
          releasedAt: timeFormat(pr.releasedAt, tz),
          updatedAt: timeFormat(pr.updatedAt, tz),
        }).join('\t')
      }),
  ].join('\n')

  await sheet.paste(data)
}

export const exportReviewResponsesToSpreadsheet = async (
  reviewResponses: { repo: string; number: string; author: string; createdAt: string; responseTime: number }[],
  exportSetting: ExportSetting,
) => {
  const tz = 'Asia/Tokyo'
  const sheet = createSheetApi({
    spreadsheetId: exportSetting.sheetId,
    sheetTitle: 'reviewres',
    clientEmail: exportSetting.clientEmail,
    privateKey: exportSetting.privateKey,
  })
  const header = ['repo', 'number', 'author', 'createdAt', 'responseTime'].join('\t')

  const data = [
    header,
    ...reviewResponses.map((res) => {
      // １行タブ区切り x 改行区切りで全行まとめてペースト
      return Object.values({
        repo: res.repo,
        number: res.number,
        author: res.author,
        createdAt: timeFormat(res.createdAt, tz),
        responseTime: res.responseTime,
      }).join('\t')
    }),
  ].join('\n')

  await sheet.paste(data)
}
