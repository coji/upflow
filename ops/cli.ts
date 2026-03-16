import { cli, command } from 'cleye'
import { pullDbCommand } from './commands/pull-db'
import { restoreDbCommand } from './commands/restore-db'

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

const restoreDb = command(
  {
    name: 'restore-db',
    flags: {
      name: {
        type: String,
        description:
          'Backup name to restore (e.g. backup_2026-03-15T14-18-50-365Z). Omit to list available backups.',
      },
    },
    help: {
      description: 'Restore database files from a previous backup.',
    },
  },
  (argv) => {
    const { help, ...flags } = argv.flags
    restoreDbCommand(flags)
  },
)

cli({
  name: 'ops',
  commands: [pullDb, restoreDb],
})
