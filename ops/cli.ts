import { cli, command } from 'cleye'
import consola from 'consola'
import { pullDbCommand } from './commands/pull-db'
import { restoreDbCommand } from './commands/restore-db'
import { restoreVerifyCommand } from './commands/restore-verify'

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

const restoreVerify = command(
  {
    name: 'restore-verify',
    help: {
      description:
        'Verify Litestream backups by restoring data.db and all tenant_*.db replicas from R2 into a temp directory and counting key tables. ' +
        'Uses repo-root litestream.yml for bucket/replica path (LITESTREAM_REPLICA_PREFIX) and AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION (see docs/ops/litestream-r2.md).',
    },
  },
  () => {
    void restoreVerifyCommand()
      .then((code) => {
        process.exit(code)
      })
      .catch((e) => {
        consola.error(e)
        process.exit(1)
      })
  },
)

const argv = cli({
  name: 'ops',
  commands: [pullDb, restoreDb, restoreVerify],
})

if (!argv.command) {
  argv.showHelp()
}
