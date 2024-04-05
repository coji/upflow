import type { Company } from '@prisma/client'
import { pipe, sortBy } from 'remeda'
import dayjs from '~/app/libs/dayjs'
import { prisma } from '~/app/services/db.server'
export type { PullRequest } from '@prisma/client'
export const getMergedPullRequestReport = async (
  companyId: Company['id'],
  startDate: string,
) => {
  const pullrequests = await prisma.pullRequest.findMany({
    where: {
      repository: { companyId },
      mergedAt: { gt: startDate },
      author: { not: { contains: '[bot]' } },
    },
    orderBy: [{ mergedAt: 'desc' }, { pullRequestCreatedAt: 'desc' }],
  })

  return pipe(
    pullrequests.map((pr) => {
      return {
        ...pr,
        createAndMergeDiff: pr.mergedAt
          ? // 最初のコミットからマージまでの日数を計算
            dayjs(pr.mergedAt).diff(dayjs(pr.firstCommittedAt), 'hours') / 24
          : null,
      }
    }),
    sortBy((pr) => (pr.createAndMergeDiff ? -pr.createAndMergeDiff : 0)),
  )
}
