import { defineJob } from '@coji/durably'
import { z } from 'zod'
import type { OrganizationId } from '~/app/types/organization'
import { getOrganization } from '~/batch/db/queries'
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

    // scopes: undefined → full-org processing, scopes: [] → no-op
    if (input.scopes !== undefined && input.scopes.length === 0) {
      return { pullCount: 0 }
    }

    const organization = await step.run('load-organization', async () => {
      step.progress(0, 0, 'Loading organization...')
      const org = await getOrganization(orgId)
      if (!org.organizationSetting) {
        throw new Error('No organization setting configured')
      }
      return {
        organizationSetting: org.organizationSetting,
        botLogins: org.botLogins,
        repositories: org.repositories,
        exportSetting: org.exportSetting,
      }
    })

    const scopes = input.scopes
    const filterPrNumbers =
      scopes && scopes.length > 0
        ? new Map(
            scopes.map((s) => [s.repositoryId, new Set(s.prNumbers)] as const),
          )
        : undefined
    const allowedRepoIds =
      scopes && scopes.length > 0
        ? new Set(scopes.map((s) => s.repositoryId))
        : undefined
    const skipRepo = allowedRepoIds
      ? (repoId: string) => !allowedRepoIds.has(repoId)
      : undefined

    const { pullCount } = await analyzeAndFinalizeSteps(
      step,
      orgId,
      organization,
      {
        filterPrNumbers,
        skipRepo,
        steps: input.steps,
      },
    )

    await triggerClassifyStep(step, orgId)

    return { pullCount }
  },
})
