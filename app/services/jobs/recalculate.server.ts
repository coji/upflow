import { defineJob } from '@coji/durably'
import { z } from 'zod'
import type { OrganizationId } from '~/app/types/organization'
import { getOrganization } from '~/batch/db/queries'
import {
  analyzeAndFinalizeSteps,
  triggerClassifyStep,
} from './shared-steps.server'

export const recalculateJob = defineJob({
  name: 'recalculate',
  input: z.object({
    organizationId: z.string(),
    steps: z.object({
      upsert: z.boolean(),
      // classify is accepted for backward compatibility with in-flight jobs
      // but is handled as a separate classify job trigger
      classify: z.boolean().default(false),
      export: z.boolean(),
    }),
  }),
  output: z.object({
    pullCount: z.number(),
  }),
  run: async (step, input) => {
    const orgId = input.organizationId as OrganizationId

    // Step 1: Load organization data
    const organization = await step.run('load-organization', async () => {
      step.progress(0, 0, 'Loading organization...')
      const org = await getOrganization(orgId)
      if (!org.organizationSetting) {
        throw new Error('No organization setting configured')
      }
      if (!org.integration) {
        throw new Error('No integration configured')
      }
      return {
        organizationSetting: org.organizationSetting,
        repositories: org.repositories,
        exportSetting: org.exportSetting,
      }
    })

    // Steps 2-5: Analyze → Upsert → Export → Finalize
    const result = await analyzeAndFinalizeSteps(step, orgId, organization, {
      steps: { upsert: input.steps.upsert, export: input.steps.export },
    })

    // Trigger classify job if requested (fire-and-forget)
    if (input.steps.classify) {
      await triggerClassifyStep(step, orgId)
    }

    return result
  },
})
