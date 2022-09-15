import type { Company } from '@prisma/client'
import { prisma } from '~/app/db.server'
import { createSheetApi } from '~/app/libs/sheets'
import { timeFormat } from '../helper/timeformat'
import dayjs from 'dayjs'

/**
 * google sheets にエクスポート
 * @param company
 */
export const exportToSpreadsheet = async (company: Company) => {
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

  const repositories = await prisma.repository.findMany({
    where: {
      companyId: company.id
    }
  })
  const results = await prisma.pullRequest.findMany({
    where: {
      AND: {
        repositoryId: {
          in: repositories.map((repo) => repo.id)
        },
        updatedAt: {
          not: null
        }
      }
    }
  })

  const data = [
    header,
    ...results
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
          firstCommitedAt: timeFormat(firstCommittedAt), // ISO形式から YYYY-MM-DD HH:mm:ss に変換。TODO: タイムゾーン対応?
          pullRequestCreatedAt: timeFormat(pullRequestCreatedAt),
          firstReviewedAt: timeFormat(firstReviewedAt),
          mergedAt: timeFormat(mergedAt),
          releasedAt: timeFormat(releasedAt),
          updatedAt: timeFormat(updatedAt)
        }).join('\t')
      })
  ].join('\n')

  // ガベージコレクションを起動してがんばる
  if (global.gc) {
    global.gc()
  }

  await sheet.paste(data)
}
