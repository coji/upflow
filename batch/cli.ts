import { cli, command } from 'cleye'
import 'dotenv/config'
import { backfillCommand } from './commands/backfill'
import { classifyCommand } from './commands/classify'
import { fetchCommand } from './commands/fetch'
import { reportCommand } from './commands/report'
import { upsertCommand } from './commands/upsert'

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
        'Re-fetch PR metadata to fill missing fields in raw data. Run upsert after this.',
    },
  },
  async (argv) => {
    await backfillCommand({
      organizationId: argv._.organizationId,
      files: argv.flags.files,
    })
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
  async (argv) => {
    const { help, ...rest } = argv.flags
    await fetchCommand({
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
  async (argv) => {
    const { help, ...rest } = argv.flags
    await reportCommand({ organizationId: argv._.organizationId, ...rest })
  },
)

const upsert = command(
  {
    name: 'upsert',
    parameters: ['[organization id]'],
    help: { description: 'upsert report data to frontend database.' },
  },
  async (argv) => {
    const { help, ...rest } = argv.flags
    await upsertCommand({ organizationId: argv._.organizationId, ...rest })
  },
)

cli({
  commands: [backfill, classify, fetch, report, upsert],
})
