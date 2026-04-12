import { cli, command } from 'cleye'
import consola from 'consola'
import 'dotenv/config'
import {
  captureExceptionToSentry,
  flushSentryNode,
} from '~/app/libs/sentry-node.server'

// コマンドは全て dynamic import で遅延ロードする。
// トップレベル import にすると durably.server.ts が読み込まれて
// worker ポーリングが起動し、durably 不要なコマンド（classify 等）でも
// プロセスが終了しなくなる。

const crawl = command(
  {
    name: 'crawl',
    parameters: ['[organization id]'],
    flags: {
      refresh: {
        type: Boolean,
        description: 'Full refresh (re-fetch all PRs from GitHub)',
        default: false,
      },
      pr: {
        type: [Number],
        description:
          'Specific PR numbers (requires --repository). e.g. --repository org/repo --pr 123',
      },
      repository: {
        type: String,
        description:
          'Target repository as owner/repo or repository id (required with --pr)',
      },
    },
    help: {
      description:
        'Fetch raw PR data from GitHub, then enqueue process (analyze → upsert → export → classify). Runs as a durable job.',
    },
  },
  async (argv) => {
    const { crawlCommand } = await import('./commands/crawl')
    const prNumbers = argv.flags.pr?.length ? argv.flags.pr : undefined
    if (prNumbers && !argv.flags.repository) {
      consola.error('--repository is required when using --pr')
      process.exit(1)
    }
    await crawlCommand({
      organizationId: argv._.organizationId,
      refresh: argv.flags.refresh,
      prNumbers,
      repository: argv.flags.repository,
    })
  },
)

const processCmd = command(
  {
    name: 'process',
    parameters: ['[organization id]'],
    flags: {
      export: {
        type: Boolean,
        description: 'Also export to spreadsheet',
        default: false,
      },
    },
    help: {
      description:
        'Analyze stored raw data → upsert → export → classify trigger. No GitHub API calls. Runs as a durable job.',
    },
  },
  async (argv) => {
    const { processCommand } = await import('./commands/process')
    await processCommand({
      organizationId: argv._.organizationId,
      export: argv.flags.export,
    })
  },
)

const classify = command(
  {
    name: 'classify',
    parameters: ['[organization id]'],
    flags: {
      force: {
        type: Boolean,
        description: 'Re-classify all PRs (default: only unclassified)',
        default: false,
      },
      limit: {
        type: Number,
        description: 'Max number of PRs to classify',
      },
    },
    help: {
      description: 'Classify PRs with LLM. Requires GEMINI_API_KEY.',
    },
  },
  async (argv) => {
    const { classifyCommand } = await import('./commands/classify')
    await classifyCommand({
      organizationId: argv._.organizationId,
      force: argv.flags.force,
      limit: argv.flags.limit,
    })
  },
)

const backfill = command(
  {
    name: 'backfill',
    parameters: ['[organization id]'],
    flags: {
      files: {
        type: Boolean,
        description: 'Backfill PR file lists only (REST API)',
        default: false,
      },
    },
    help: {
      description:
        'Re-fetch PR metadata to fill missing fields in raw data. Runs as a durable job. Run process after this.',
    },
  },
  async (argv) => {
    const { backfillCommand } = await import('./commands/backfill')
    await backfillCommand({
      organizationId: argv._.organizationId,
      files: argv.flags.files,
    })
  },
)

const report = command(
  {
    name: 'report',
    parameters: ['[organization id]'],
    help: { description: 'Report cycletime from fetched resources.' },
  },
  async (argv) => {
    const { reportCommand } = await import('./commands/report')
    const { help, ...rest } = argv.flags
    await reportCommand({ organizationId: argv._.organizationId, ...rest })
  },
)

const backfillInstallationMembership = command(
  {
    name: 'backfill-installation-membership',
    parameters: ['[organization id]'],
    flags: {
      dryRun: {
        type: Boolean,
        description:
          'Print the planned changes without writing to the database',
        default: false,
      },
    },
    help: {
      description:
        'One-shot migration: assign github_installation_id to repositories and seed memberships for orgs whose GitHub App method has exactly one active installation.',
    },
  },
  async (argv) => {
    const { backfillInstallationMembershipCommand } =
      await import('./commands/backfill-installation-membership')
    await backfillInstallationMembershipCommand({
      organizationId: argv._.organizationId,
      dryRun: argv.flags.dryRun,
    })
  },
)

const reassignBrokenRepositories = command(
  {
    name: 'reassign-broken-repositories',
    parameters: ['[organization id]'],
    flags: {
      repository: {
        type: String,
        description:
          'Reassign a single repository by id (default: every broken repo)',
      },
    },
    help: {
      description:
        'Reassign repositories whose canonical GitHub App installation was lost. Picks a new canonical from the membership table when exactly one eligible candidate exists.',
    },
  },
  async (argv) => {
    const { reassignBrokenRepositoriesCommand } =
      await import('./commands/reassign-broken-repositories')
    await reassignBrokenRepositoriesCommand({
      organizationId: argv._.organizationId,
      repositoryId: argv.flags.repository,
    })
  },
)

process.on('unhandledRejection', async (error) => {
  captureExceptionToSentry(error, { tags: { component: 'batch-cli' } })
  await flushSentryNode()
  process.exit(1)
})

cli({
  commands: [
    crawl,
    processCmd,
    classify,
    backfill,
    report,
    backfillInstallationMembership,
    reassignBrokenRepositories,
  ],
})
