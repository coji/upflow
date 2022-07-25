import 'dotenv/config'
import { cli, command } from 'cleye'
import { fetchCommand } from '~/batch/commands/fetch'
import { reportCommand } from '~/batch/commands/report'
import { reviewCommand } from '~/batch/commands/review'
import { commitCommand } from '~/batch/commands/commit'
import { upsertCommand } from '~/batch/commands/upsert'

const fetch = command(
  {
    name: 'fetch',
    flags: {
      refresh: {
        type: Boolean,
        description: 'refresh all mergerequest resources.',
        default: false
      }
    },
    help: { description: 'Fetch all resources from gitlab api.' }
  },
  (argv) => fetchCommand({ refresh: argv.flags.refresh })
)

const report = command(
  {
    name: 'report',
    help: { description: 'Report cycletime from fetched resources.' }
  },
  () => reportCommand()
)

const upsert = command(
  {
    name: 'upsert',
    help: { description: 'upsert report data to frontend database.' }
  },
  () => upsertCommand()
)

const commit = command(
  {
    name: 'commit',
    parameters: ['[mergerequest iid]'],
    help: { description: 'List commits for a given mergerequest' }
  },
  (argv) => commitCommand(Number(argv._.mergerequestIid))
)

const review = command(
  {
    name: 'review',
    parameters: ['<mergerequest iid>'],
    help: { description: 'List review comments for a given mergerequest' }
  },
  (argv) => reviewCommand(Number(argv._.mergerequestIid))
)

cli({
  commands: [fetch, report, upsert, commit, review]
})
