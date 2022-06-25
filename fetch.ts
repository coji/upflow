import { setTimeout } from 'timers/promises'
import { Gitlab } from '@gitbeaker/node'
import 'dotenv/config'
import { json, path } from './src/helper'
import { fetchFactory } from './src/fetcher'

async function main() {
  const api = new Gitlab({ token: process.env.PRIVATE_TOKEN })
  const fetcher = fetchFactory(api)

  console.log('fetch all merge requests...')
  const mr = await fetcher.mergerequests()
  json.save('mergerequests.json', mr)
  console.log('fetch all merge requests done.')

  for (const iid of mr.map((m) => m.iid)) {
    console.log(`${iid} commits`)
    const commits = await fetcher.commits(iid)
    json.save(path.commitsJsonFilename(iid), commits)

    console.log(`${iid} discussions`)
    const discussions = await fetcher.discussions(iid)
    json.save(path.discussionsJsonFilename(iid), discussions)

    await setTimeout(1000)
  }
}

main()
