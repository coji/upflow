import { cli, command } from 'cleye'
import 'dotenv/config'
import { fetchCommand } from './commands/fetch'
import { reportCommand } from './commands/report'
import { upsertCommand } from './commands/upsert'
import { vacuumCommand } from './commands/vacuum'

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
    help: { description: 'Fetch all resources from gitlab api.' },
  },
  (argv) => {
    const { help, ...rest } = argv.flags
    fetchCommand({ companyId: argv._.companyId, repositoryId: argv._.repositoryId, ...rest })
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

const vacuum = command(
  {
    name: 'vacuum',
    help: { description: 'vacuum database' },
  },
  (argv) => {
    vacuumCommand()
  },
)

cli({
  commands: [fetch, report, upsert, vacuum],
})
