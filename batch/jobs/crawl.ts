import { prisma } from '~/app/db.server'
import { createProvider } from '../provider'

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

    const provider = createProvider(integration.provider)
    if (!provider) {
      console.error('provider cant detected', company.id, company.name, integration.provider)
      continue
    }

    for (const repository of company.repositories) {
      if (!provider) {
        continue
      }
      console.log('fetch started...')
      await provider.fetch(integration, repository, { halt: false, refresh: false })
      console.log('fetch completed.')
    }

    console.log('upsert started...')
    await provider.upsert(company.repositories)
    console.log('upsert completed.')
  }
}

crawlMain()
