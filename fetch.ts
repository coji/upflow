import { Gitlab } from '@gitbeaker/node'
import 'dotenv/config'
import { json, path } from './src/helper'
import { createFetcher } from './src/fetcher'

async function main() {
  const api = new Gitlab({ token: process.env.PRIVATE_TOKEN })
  const fetcher = createFetcher(api)

  // すべてのMR
  console.log('fetch all merge requests...')
  const mr = await fetcher.mergerequests()
  json.save('mergerequests.json', mr)
  console.log('fetch all merge requests done.')

  // production ブランチのすべての commit
  console.log('fetch production commits...')
  const releaseCommits = await fetcher.refCommits('production')
  for (const commit of releaseCommits) {
    json.save(path.releaseCommitsJsonFilename(commit.id), commit)
  }
  console.log('fetch production commits done.')

  for (const iid of mr.map((m) => m.iid)) {
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

main()
