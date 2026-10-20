import { defineJob } from '@coji/durably'
import { z } from 'zod'
import type { OrganizationId } from '~/app/types/organization'
import { getOrganization } from '~/batch/db/queries'
import { collectProcessWorkSet, markProcessed } from './process-work-set.server'
import {
  analyzeAndFinalizeSteps,
  triggerClassifyStep,
} from './shared-steps.server'

const processScopeSchema = z.object({
  repositoryId: z.string(),
  prNumbers: z.array(z.number()),
})

export const processJob = defineJob({
  name: 'process',
  input: z.object({
    organizationId: z.string(),
    steps: z
      .object({
        upsert: z.boolean(),
        export: z.boolean(),
      })
      .optional(),
    scopes: z.array(processScopeSchema).optional(),
  }),
  output: z.object({
    pullCount: z.number(),
  }),
  run: async (step, input) => {
    const orgId = input.organizationId as OrganizationId

    // scopes: undefined → full-org processing.
    // Otherwise process every dirty raw row plus the given scopes: scopes may
    // be dropped when a trigger coalesces onto a pending run, so they are only
    // a hint, never the source of truth (#285).
    const fullOrg = input.scopes === undefined
    const workSet = await step.run('collect-work-set', () =>
      collectProcessWorkSet(orgId, { fullOrg, include: input.scopes }),
    )
    if (workSet.length === 0) {
      step.log.info('No unprocessed PRs, skipping process.')
      return { pullCount: 0 }
    }

    // Fetch org once before step (secrets stay outside step output)
    const org = await getOrganization(orgId)

    const organization = await step.run('load-organization', () => {
      step.progress(0, 0, 'Loading organization...')
      if (!org.organizationSetting) {
        throw new Error('No organization setting configured')
      }
      return {
        organizationSetting: org.organizationSetting,
        botLogins: org.botLogins,
        repositories: org.repositories,
      }
    })

    const filterPrNumbers = fullOrg
      ? undefined
      : new Map(
          workSet.map(
            (s) => [s.repositoryId, new Set(s.prs.map(([n]) => n))] as const,
          ),
        )
    const skipRepo = filterPrNumbers
      ? (repoId: string) => !filterPrNumbers.has(repoId)
      : undefined

    const { pullCount } = await analyzeAndFinalizeSteps(
      step,
      orgId,
      organization,
      org.exportSetting,
      {
        filterPrNumbers,
        skipRepo,
        steps: input.steps,
      },
    )

    // Without upsert the analyzed results are discarded, so the rows stay dirty.
    if (input.steps?.upsert ?? true) {
      await step.run('mark-processed', () => markProcessed(orgId, workSet))
    }

    await triggerClassifyStep(step, orgId)

    return { pullCount }
  },
})
