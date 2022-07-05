import 'dotenv/config'
import { cli, command } from 'cleye'
import { fetchCommand } from '@/commands/fetch'
import { reportCommand } from '@/commands/report'
import { reviewCommand } from '@/commands/review'

cli({
  commands: [
    command(
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
    ),
    command(
      {
        name: 'report',
        help: { description: 'Report cycletime from fetched resources.' }
      },
      () => reportCommand()
    ),
    command(
      {
        name: 'review',
        parameters: ['<mergerequest iid>'],
        help: { description: 'List review comments for a given mergerequest' }
      },
      (argv) => reviewCommand(Number(argv._.mergerequestIid))
    )
  ]
})
