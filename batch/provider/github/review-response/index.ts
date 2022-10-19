import type { ShapedGitHubReviewComment } from '../model'
import { sortBy } from 'remeda'
import dayjs from '~/app/libs/dayjs'

export const analyzeReviewResponse = (comments: ShapedGitHubReviewComment[]) => {
  let lastRes: ShapedGitHubReviewComment | null = null
  const responses = []

  // 古い順に並べて、レビュアーが変わったらその時間差を反応時間として記録
  for (const res of sortBy(
    comments.filter((d) => dayjs(d.createdAt) > dayjs().add(-90, 'days')),
    [(x) => x.createdAt, 'asc']
  )) {
    if (lastRes && lastRes.user !== res.user) {
      responses.push({
        author: res.user,
        createdAt: res.createdAt,
        responseTime: (dayjs(res.createdAt).unix() - dayjs(lastRes.createdAt).unix()) / 60 / 60
      })
    }
    lastRes = res
  }

  return responses
}
