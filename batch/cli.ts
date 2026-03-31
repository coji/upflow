import { cli, command } from 'cleye'
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
        description: 'Specific PR numbers to refresh (e.g. --pr 123 --pr 456)',
      },
    },
    help: {
      description:
        'Fetch from GitHub → analyze → upsert → export → trigger classify. Runs as a durable job.',
    },
  },
  async (argv) => {
    const { crawlCommand } = await import('./commands/crawl')
    await crawlCommand({
      organizationId: argv._.organizationId,
      refresh: argv.flags.refresh,
      prNumbers: argv.flags.pr?.length ? argv.flags.pr : undefined,
    })
  },
)

const recalculate = command(
  {
    name: 'recalculate',
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
        'Re-analyze raw data → upsert to DB. No GitHub API calls. Runs as a durable job.',
    },
  },
  async (argv) => {
    const { recalculateCommand } = await import('./commands/recalculate')
    await recalculateCommand({
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
        'Re-fetch PR metadata to fill missing fields in raw data. Runs as a durable job. Run recalculate after this.',
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

process.on('unhandledRejection', async (error) => {
  captureExceptionToSentry(error, { tags: { component: 'batch-cli' } })
  await flushSentryNode()
  process.exit(1)
})

cli({
  commands: [crawl, recalculate, classify, backfill, report],
})
