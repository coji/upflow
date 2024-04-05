import type { Company } from '@prisma/client'
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

  return pullrequests.map((pr) => {
    return {
      ...pr,
      createAndMergeDiff: pr.mergedAt
        ? (
            dayjs(pr.mergedAt).diff(dayjs(pr.pullRequestCreatedAt), 'hours') /
            24
          ).toFixed(1)
        : null,
    }
  })
}
