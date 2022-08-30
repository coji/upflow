import { parentPort } from 'node:worker_threads'
import { prisma } from '~/app/db.server'
import { createProvider } from '../provider'

const options = { refresh: false, halt: false }
if (parentPort) {
  parentPort.once('message', (message) => {
    if (message === 'cancel') {
      console.log('cancel message received')
      options.halt = true
    }
  })
}

const crawlMain = async () => {
  const companies = await prisma.company.findMany({
    include: { integration: true, repositories: true }
  })

  for (const company of companies) {
    const integration = company.integration
    if (!integration) {
      console.error('integration not set:', company.id, company.name)
      continue
    }

    const provider = createProvider(integration)
    if (!provider) {
      console.error('provider cant detected', company.id, company.name, integration.provider)
      continue
    }

    for (const repository of company.repositories) {
      if (!provider) {
        continue
      }
      console.log('fetch started...')
      await provider.fetch(repository, options)
      console.log('fetch completed.')
    }

    console.log('upsert started...')
    await provider.upsert(company.repositories)
    console.log('upsert completed.')
  }
}

crawlMain()
