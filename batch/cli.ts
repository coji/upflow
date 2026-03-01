import { cli, command } from 'cleye'
import 'dotenv/config'
import { backfillCommand } from './commands/backfill'
import { fetchCommand } from './commands/fetch'
import { reportCommand } from './commands/report'
import { upsertCommand } from './commands/upsert'

const backfill = command(
  {
    name: 'backfill',
    parameters: ['[organization id]'],
    help: {
      description:
        'Re-fetch PR metadata to fill missing fields in raw data. Run upsert after this.',
    },
  },
  (argv) => {
    backfillCommand({ organizationId: argv._.organizationId })
  },
)

const fetch = command(
  {
    name: 'fetch',
    parameters: ['[organization id]', '[repository id]'],
    flags: {
      refresh: {
        type: Boolean,
        description: 'refresh all mergerequest resources.',
        default: false,
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
      organizationId: argv._.organizationId,
      repositoryId: argv._.repositoryId,
      ...rest,
    })
  },
)

const report = command(
  {
    name: 'report',
    parameters: ['[organization id]'],
    help: { description: 'Report cycletime from fetched resources.' },
  },
  (argv) => {
    const { help, ...rest } = argv.flags
    reportCommand({ organizationId: argv._.organizationId, ...rest })
  },
)

const upsert = command(
  {
    name: 'upsert',
    parameters: ['[organization id]'],
    help: { description: 'upsert report data to frontend database.' },
  },
  (argv) => {
    const { help, ...rest } = argv.flags
    upsertCommand({ organizationId: argv._.organizationId, ...rest })
  },
)

cli({
  commands: [backfill, fetch, report, upsert],
})
