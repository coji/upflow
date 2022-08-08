import { loadConfig, allConfigs } from '../config'
import { createStore } from '../store'
import { createFetcher } from '../fetcher'
import { createAggregator } from '../aggregator'
import invariant from 'tiny-invariant'

interface FetchCommandProps {
  companyId?: string
  refresh: boolean
}

export async function fetchCommand(props: FetchCommandProps) {
  console.log(props)
  if (!props.companyId) {
    console.log(`Error: company id should spacify`)
    console.log((await allConfigs()).map((c) => `${c.companyName}\t${c.companyId}`).join('\n'))
    return
  }

  const config = await loadConfig(props.companyId)
  invariant(config, `company id not found: ${props.companyId}`)
  invariant(config.integraiton, `Integration not found on company: ${props.companyId}`)
  invariant(config.integraiton.privateToken, `Private token shoud specified: integration #${props.companyId}`)

  for (const repository of config.repositories) {
    const fetcher = createFetcher({
      projectId: repository.projectId,
      privateToken: config.integraiton.privateToken
    })

    const aggregator = createAggregator()
    const store = createStore({
      companyId: config.companyId,
      repositoryId: repository.id
    })

    console.log('fetch started: ')
    console.log({
      companyId: config.companyId,
      companyName: config.companyName,
      integration: {
        provider: config.integraiton?.provider,
        method: config.integraiton?.method
      },
      repository: repository
    })

    // 前回最終取得されたMR
    const leastMergeRequest = aggregator.leastUpdatedMergeRequest(await store.loader.mergerequests().catch(() => []))
    console.log('last fetched at:', leastMergeRequest?.updated_at)

    // すべてのMR
    console.log('fetch all merge requests...')
    const allMergeRequests = await fetcher.mergerequests()
    store.save('mergerequests.json', allMergeRequests)
    console.log('fetch all merge requests done.')

    // production ブランチのすべての commit
    console.log('fetch production commits...')
    const releaseCommits = await fetcher.refCommits('production', props.refresh ? leastMergeRequest?.updated_at : undefined)
    for (const commit of releaseCommits) {
      store.save(store.path.releaseCommitsJsonFilename(commit.id), commit)
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
      store.save(store.path.commitsJsonFilename(iid), commits)

      // 個別MRのすべてのディスカッション(レビューコメント含む)
      console.log(`${iid} discussions`)
      const discussions = await fetcher.discussions(iid)
      store.save(store.path.discussionsJsonFilename(iid), discussions)

      // await setTimeout(1000)
    }
  }
}
