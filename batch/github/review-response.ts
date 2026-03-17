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
    comments.filter(
      (d) => dayjs.utc(d.createdAt) > dayjs.utc().add(-90, 'days'),
    ),
    [(x) => x.createdAt, 'asc'],
  )) {
    if (lastRes && lastRes.user !== res.user) {
      responses.push({
        author: res.user,
        createdAt: res.createdAt,
        responseTime:
          (dayjs.utc(res.createdAt).unix() -
            dayjs.utc(lastRes.createdAt).unix()) /
          60 /
          60,
      })
    }
    lastRes = res
  }

  return responses
}
