import type { Company, PullRequest } from '@prisma/client'
import { prisma } from '~/app/db.server'
import { createSheetApi } from '~/app/libs/sheets'
import { timeFormat } from '../helper/timeformat'
import dayjs from '~/app/libs/dayjs'

/**
 * google sheets にエクスポート
 * @param company
 */
export const exportToSpreadsheet = async (company: Company, pullrequests: PullRequest[]) => {
  const tz = 'Asia/Tokyo'
  const exportSetting = await prisma.exportSetting.findFirst({ where: { companyId: company.id } })
  if (!exportSetting) {
    return
  }
  const sheet = await createSheetApi({
    sheetId: exportSetting.sheetId,
    clientEmail: exportSetting.clientEmail,
    privateKey: exportSetting.privateKey
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
    'updatedAt'
  ].join('\t')

  const data = [
    header,
    ...pullrequests
      .filter((pr) => pr.updatedAt && dayjs(pr.updatedAt) > dayjs().add(-90, 'days'))
      .map((pr) => {
        // １行タブ区切り x 改行区切りで全行まとめてペースト
        const {
          repositoryId, // 消す
          updatedAt,
          firstCommittedAt,
          pullRequestCreatedAt,
          firstReviewedAt,
          mergedAt,
          releasedAt,
          ...rest
        } = pr
        return Object.values({
          ...rest,
          firstCommitedAt: timeFormat(firstCommittedAt, tz), // ISO形式から YYYY-MM-DD HH:mm:ss に変換。TODO: タイムゾーン対応?
          pullRequestCreatedAt: timeFormat(pullRequestCreatedAt, tz),
          firstReviewedAt: timeFormat(firstReviewedAt, tz),
          mergedAt: timeFormat(mergedAt, tz),
          releasedAt: timeFormat(releasedAt, tz),
          updatedAt: timeFormat(updatedAt, tz)
        }).join('\t')
      })
  ].join('\n')

  // ガベージコレクションを起動してがんばる
  if (global.gc) {
    global.gc()
  }

  await sheet.paste(data)
}
