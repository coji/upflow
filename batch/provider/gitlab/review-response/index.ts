import type { ShapedGitLabDiscussionNote } from '../model'
import { sortBy } from 'remeda'
import dayjs from '~/app/libs/dayjs'

export const analyzeReviewResponse = (discussions: ShapedGitLabDiscussionNote[]) => {
  let lastRes: ShapedGitLabDiscussionNote | null = null
  const responses = []

  // 古い順に並べて、レビュアーが変わったらその時間差を反応時間として記録
  for (const res of sortBy(
    discussions.filter((d) => dayjs(d.createdAt) > dayjs().add(-90, 'days')),
    [(x) => x.createdAt, 'asc']
  )) {
    if (lastRes && lastRes.author !== res.author) {
      responses.push({
        author: res.author,
        createdAt: res.createdAt,
        responseTime: (dayjs(res.createdAt).unix() - dayjs(lastRes.createdAt).unix()) / 60 / 60
      })
    }
    lastRes = res
  }

  return responses
}
