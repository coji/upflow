import { Gitlab } from '@gitbeaker/node'
import { json, path } from '../helper'
import { createFetcher } from '../fetcher'
import { createLoader } from '../loader'
import { createAggregator } from '../aggregator'

interface FetchCommandProps {
  refresh: boolean
}

export async function fetchCommand(props: FetchCommandProps) {
  const api = new Gitlab({ token: process.env.PRIVATE_TOKEN })
  const fetcher = createFetcher(api)
  const loader = createLoader()
  const aggregator = createAggregator()

  // 前回最終取得されたMR
  const leastMergeRequest = aggregator.leastUpdatedMergeRequest(await loader.mergerequests().catch(() => []))
  console.log('last fetched at:', leastMergeRequest?.updated_at)

  // すべてのMR
  console.log('fetch all merge requests...')
  const allMergeRequests = await fetcher.mergerequests()
  json.save('mergerequests.json', allMergeRequests)
  console.log('fetch all merge requests done.')

  // production ブランチのすべての commit
  console.log('fetch production commits...')
  const releaseCommits = await fetcher.refCommits('production', props.refresh ? leastMergeRequest?.updated_at : undefined)
  for (const commit of releaseCommits) {
    json.save(path.releaseCommitsJsonFilename(commit.id), commit)
  }
  console.log('fetch production commits done.')

  for (const mr of allMergeRequests) {
    const isNew = leastMergeRequest ? mr.updated_at > leastMergeRequest.updated_at : true // 新しく fetch してきた MR
    // すべて再フェッチせず、オープン以外、前回以前fetchしたMRの場合はスキップ
    if (!props.refresh && mr.state !== 'opened' && !isNew) {
      continue
    }
    const iid = mr.iid

    // 個別MRのすべてのコミット
    console.log(`${iid} commits`)
    const commits = await fetcher.mergerequestCommits(iid)
    json.save(path.commitsJsonFilename(iid), commits)

    // 個別MRのすべてのディスカッション(レビューコメント含む)
    console.log(`${iid} discussions`)
    const discussions = await fetcher.discussions(iid)
    json.save(path.discussionsJsonFilename(iid), discussions)

    // await setTimeout(1000)
  }
}
