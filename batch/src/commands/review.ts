import dayjs from 'dayjs'
import { createLoader } from '../loader'
import { createAggregator } from '../aggregator'

export async function reviewCommand(iid: number) {
  const loader = createLoader()
  const aggregator = createAggregator()
  const discussions = await loader.discussions(iid)
  const reviews = aggregator.reviewComments(discussions)
  reviews
    .sort((a, b) => (b.created_at < a.created_at ? 1 : -1))
    .map((review) =>
      [dayjs(review.created_at).format('YYYY-MM-DD HH:mm'), review.type, review.author.username, review.body.substring(0, 20).replaceAll('\n', '')].join('\t')
    )
    .forEach((review) => console.log(review))
}
