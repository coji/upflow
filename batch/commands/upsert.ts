import invariant from 'tiny-invariant'
import { loadConfig, allConfigs } from '../config'
import { createStore } from '../store'
import { buildMergeRequests } from '../mergerequest'
import { upsertMergeRequest } from '~/app/models/mergeRequest.server'

interface UpsertCommandProps {
  companyId?: string
}
export async function upsertCommand({ companyId }: UpsertCommandProps) {
  if (!companyId) {
    console.log('config should specified')
    console.log((await allConfigs()).map((c) => `${c.companyName}\t${c.companyId}`).join('\n'))
    return
  }
  const config = await loadConfig(companyId)
  invariant(config, `config not found: ${companyId}`)

  for (const repository of config.repositories) {
    const store = createStore({
      companyId: config.companyId,
      repositoryId: repository.id
    })
    const mergerequests = await store.loader.mergerequests()

    const results = await buildMergeRequests(
      {
        companyId: config.companyId,
        repositoryId: repository.id
      },
      mergerequests
    )
    for (const mr of results) {
      await upsertMergeRequest(mr)
      //      await got.post(API_URL, { json: { item: mr } })
    }
  }
}
