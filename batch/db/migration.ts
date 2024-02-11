import { FileMigrationProvider, Migrator } from 'kysely'
import fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '~/app/services/db.server'
import { crawlerDb } from './crawler-db.server'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

export const migrateToLatest = async () => {
  const companies = await prisma.company.findMany({ select: { id: true } })
  for (const company of companies) {
    using crawler = crawlerDb(company.id)
    const { db } = crawler
    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.join(__dirname, 'migrations'),
      }),
    })

    const { error, results } = await migrator.migrateToLatest()
    if (results) {
      for (const result of results) {
        if (result.status === 'Success') {
          console.log(
            `migration ${result.migrationName} was executed successful`,
          )
        } else if (result.status === 'Error') {
          console.error(`failed to execute migration "${result.migrationName}"`)
        }
      }
    }

    if (error) {
      console.error('failed to migrate')
      console.log(error)
    }
  }
}

if (import.meta.url.startsWith('file:')) {
  // .ts 拡張子を除いたファイル名を取得
  const modulePath = fileURLToPath(import.meta.url).replace(/\.ts$/, '')
  if (process.argv[1] === modulePath) {
    migrateToLatest()
  }
}
