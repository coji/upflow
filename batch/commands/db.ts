import fs from 'node:fs/promises'
import { prisma } from '~/app/services/db.server'
import { getCompanyDbPath } from '../db/crawler-db.server'
import { migrateToLatest } from '../db/migration'

export async function migrateDbCommand() {
  await migrateToLatest()
}

export async function resetDbCommand() {
  const companies = await prisma.company.findMany({ select: { id: true } })
  for (const company of companies) {
    const dbPath = getCompanyDbPath(company.id)
    await fs.rm(dbPath, { force: true, recursive: true })
    console.log(`removed: ${dbPath}`)
  }

  await migrateDbCommand()
}
