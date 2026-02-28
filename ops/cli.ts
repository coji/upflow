import { cli, command } from 'cleye'
import { pullDbCommand } from './commands/pull-db'

const pullDb = command(
  {
    name: 'pull-db',
    flags: {
      app: {
        type: String,
        description: 'Fly app name',
        default: 'upflow',
      },
      noBackup: {
        type: Boolean,
        description: 'Skip backing up existing data/',
        default: false,
      },
      noSanitize: {
        type: Boolean,
        description: 'Skip export settings sanitization',
        default: false,
      },
    },
    help: {
      description:
        'Pull production DB files from Fly.io and sanitize them for local use.',
    },
  },
  (argv) => {
    const { help, ...flags } = argv.flags
    pullDbCommand(flags)
  },
)

cli({
  name: 'ops',
  commands: [pullDb],
})
