import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import consola from 'consola'
import { cli } from 'cleye'
import { getOrganization, listAllOrganizations } from '~/batch/db'
import { createProvider } from '~/batch/provider'

const argv = cli({
  name: 'batch-golden-compare',
  parameters: [],
  flags: {
    snapshot: {
      type: String,
      description: 'snapshot json path',
      default: 'tmp/golden/batch-analysis-snapshot.json',
    },
    out: {
      type: String,
      description:
        'output json path for current results (default: tmp/golden/batch-analysis-current.json)',
      default: 'tmp/golden/batch-analysis-current.json',
    },
    org: {
      type: String,
      description: 'organization id (default: all)',
    },
    includeInactive: {
      type: Boolean,
      description: 'include inactive organizations',
      default: false,
    },
  },
})

const compareString = (a?: string | null, b?: string | null) =>
  (a ?? '').localeCompare(b ?? '')

const compareNumberish = (a: string | number, b: string | number) =>
  String(a).localeCompare(String(b), 'en', { numeric: true })

const sortPulls = (pulls: unknown[]) =>
  pulls.sort((a, b) => {
    const left = a as {
      repo?: string
      number?: string | number
      updatedAt?: string | null
    }
    const right = b as {
      repo?: string
      number?: string | number
      updatedAt?: string | null
    }
    return (
      compareString(left.repo, right.repo) ||
      compareNumberish(left.number ?? '', right.number ?? '') ||
      compareString(left.updatedAt, right.updatedAt)
    )
  })

const sortReviewResponses = (responses: unknown[]) =>
  responses.sort((a, b) => {
    const left = a as {
      repo?: string
      number?: string | number
      createdAt?: string
      author?: string
    }
    const right = b as {
      repo?: string
      number?: string | number
      createdAt?: string
      author?: string
    }
    return (
      compareString(left.repo, right.repo) ||
      compareNumberish(left.number ?? '', right.number ?? '') ||
      compareString(left.createdAt, right.createdAt) ||
      compareString(left.author, right.author)
    )
  })

const buildSnapshot = async () => {
  const organizations = argv.flags.org
    ? [await getOrganization(argv.flags.org)]
    : await listAllOrganizations()

  const snapshot = {
    generatedAt: new Date().toISOString(),
    organizations: [] as {
      id: string
      name: string
      pulls: unknown[]
      reviewResponses: unknown[]
    }[],
  }

  for (const organization of organizations) {
    if (!argv.flags.includeInactive && !organization.organizationSetting?.isActive)
      continue

    const integration = organization.integration
    if (!integration) {
      consola.warn('skip: integration not set', organization.id, organization.name)
      continue
    }

    const orgSetting = organization.organizationSetting
    if (!orgSetting) {
      consola.warn('skip: organization setting not set', organization.id, organization.name)
      continue
    }

    const provider = createProvider(integration)
    if (!provider) {
      consola.warn('skip: provider not found', integration.provider)
      continue
    }

    const { pulls, reviewResponses } = await provider.analyze(
      {
        releaseDetectionMethod: orgSetting.releaseDetectionMethod,
        releaseDetectionKey: orgSetting.releaseDetectionKey,
        excludedUsers: orgSetting.excludedUsers,
      },
      organization.repositories,
    )

    snapshot.organizations.push({
      id: organization.id,
      name: organization.name,
      pulls: sortPulls([...pulls]),
      reviewResponses: sortReviewResponses([...reviewResponses]),
    })
  }

  return snapshot
}

const readSnapshot = async (snapshotPath: string) => {
  const content = await readFile(snapshotPath, 'utf-8')
  return JSON.parse(content) as {
    organizations: {
      id: string
      name: string
      pulls: unknown[]
      reviewResponses: unknown[]
    }[]
  }
}

const toComparable = (snapshot: {
  organizations: {
    id: string
    name: string
    pulls: unknown[]
    reviewResponses: unknown[]
  }[]
}) =>
  JSON.stringify(
    {
      organizations: snapshot.organizations
        .map((org) => ({
          id: org.id,
          name: org.name,
          pulls: sortPulls([...org.pulls]),
          reviewResponses: sortReviewResponses([...org.reviewResponses]),
        }))
        .sort((a, b) => compareString(a.id, b.id)),
    },
    null,
    2,
  )

const main = async () => {
  const snapshotPath = argv.flags.snapshot
  const outPath = argv.flags.out

  const [expected, current] = await Promise.all([
    readSnapshot(snapshotPath),
    buildSnapshot(),
  ])

  await mkdir(path.dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(current, null, 2)}\n`, 'utf-8')

  const expectedText = toComparable(expected)
  const currentText = toComparable(current)

  if (expectedText === currentText) {
    consola.success('golden compare: match')
    return
  }

  consola.error('golden compare: mismatch')
  consola.info(`expected: ${snapshotPath}`)
  consola.info(`current: ${outPath}`)
  process.exitCode = 1
}

main().catch((error) => {
  consola.error(error)
  process.exitCode = 1
})
