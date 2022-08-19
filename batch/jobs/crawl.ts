import { fetchCommand } from '../commands/fetch'
import { upsertCommand } from '../commands/upsert'
import { prisma } from '~/app/db.server'

const crawlMain = async () => {
  const companies = await prisma.company.findMany({})

  for (const company of companies) {
    console.log('fetch started...')
    await fetchCommand({
      refresh: false,
      companyId: company.id
    })
    console.log('fetch completed.')

    console.log('upsert started...')
    await upsertCommand({
      companyId: company.id
    })
    console.log('upsert completed.')
  }
}

crawlMain()
