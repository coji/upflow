import 'dotenv/config'
import { cli } from 'cleye'
import { createLoader } from './src/loader'
import { createAggregator } from './src/aggregator'

const argv = cli({
  name: 'review',
  parameters: ['<mergerequest iid>']
})

async function printReviews(iid: number) {
  const loader = createLoader()
  const aggregator = createAggregator()
  const discussions = await loader.discussions(iid)
  const reviews = aggregator.reviewComments(discussions)
  console.log(JSON.stringify(reviews, null, 2))
}

printReviews(Number(argv._.mergerequestIid))
