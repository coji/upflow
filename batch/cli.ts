import { cli, command } from 'cleye'
import 'dotenv/config'
import path from 'node:path'
import { migrateDbCommand, resetDbCommand } from './commands/db'
import { fetchCommand } from './commands/fetch'
import { reportCommand } from './commands/report'
import { upsertCommand } from './commands/upsert'

process.env.UPFLOW_DATA_DIR = path.join(import.meta.dirname, '..', 'data')

const fetch = command(
  {
    name: 'fetch',
    parameters: ['[company id]', '[repository id]'],
    flags: {
      refresh: {
        type: Boolean,
        description: 'refresh all mergerequest resources.',
        default: false,
      },
      delay: {
        type: Number,
        description: 'provider api call delay for api call limit',
        default: 0,
      },
      exclude: {
        type: String,
        description: 'exclude repository id',
      },
    },
    help: { description: 'Fetch all resources from provider api.' },
  },
  (argv) => {
    const { help, ...rest } = argv.flags
    fetchCommand({
      companyId: argv._.companyId,
      repositoryId: argv._.repositoryId,
      ...rest,
    })
  },
)

const report = command(
  {
    name: 'report',
    parameters: ['[company id]'],
    help: { description: 'Report cycletime from fetched resources.' },
  },
  (argv) => {
    const { help, ...rest } = argv.flags
    reportCommand({ companyId: argv._.companyId, ...rest })
  },
)

const upsert = command(
  {
    name: 'upsert',
    parameters: ['[company id]'],
    help: { description: 'upsert report data to frontend database.' },
  },
  (argv) => {
    const { help, ...rest } = argv.flags
    upsertCommand({ companyId: argv._.companyId, ...rest })
  },
)

const migrateDb = command(
  { name: 'db-migrate', help: { description: 'Migrate crawler database.' } },
  async () => await migrateDbCommand(),
)

const resetDb = command(
  { name: 'db-reset', help: { description: 'Reset crawler database.' } },
  async () => {
    await resetDbCommand()
  },
)

cli({
  commands: [fetch, report, upsert, migrateDb, resetDb],
})
