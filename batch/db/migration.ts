import fs from 'node:fs/promises'
import * as path from 'node:path'
import { FileMigrationProvider, Migrator } from 'kysely'
import { crawlerDb } from './crawler-db.server'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

const migrateToLatest = async () => {
  const migrator = new Migrator({
    db: crawlerDb,
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
        console.log(`migration ${result.migrationName} was executed successful`)
      } else if (result.status === 'Error') {
        console.error(`failed to execute migration "${result.migrationName}"`)
      }
    }
  }

  if (error) {
    console.error('failed to migrate')
    console.log(error)
    process.exit(1)
  }
}

migrateToLatest()
