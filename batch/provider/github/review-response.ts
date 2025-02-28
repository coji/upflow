import { sortBy } from 'remeda'
import dayjs from '~/app/libs/dayjs'
import type { ShapedGitHubReviewComment } from './model'

export const analyzeReviewResponse = (
  comments: ShapedGitHubReviewComment[],
) => {
  let lastRes: ShapedGitHubReviewComment | null = null
  const responses = []

  // 古い順に並べて、レビュアーが変わったらその時間差を反応時間として記録
  for (const res of sortBy(
    comments.filter((d) => dayjs(d.created_at) > dayjs().add(-90, 'days')),
    [(x) => x.created_at, 'asc'],
  )) {
    if (lastRes && lastRes.user !== res.user) {
      responses.push({
        author: res.user,
        createdAt: res.created_at,
        responseTime:
          (dayjs(res.created_at).unix() - dayjs(lastRes.created_at).unix()) /
          60 /
          60,
      })
    }
    lastRes = res
  }

  return responses
}
