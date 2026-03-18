import { defineJob } from '@coji/durably'
import { z } from 'zod'
import { clearOrgCache } from '~/app/services/cache.server'
import type { OrganizationId } from '~/app/types/organization'
import { classifyPullRequests } from '~/batch/usecases/classify-pull-requests'

export const classifyJob = defineJob({
  name: 'classify',
  input: z.object({
    organizationId: z.string(),
    force: z.boolean().default(false),
    limit: z.number().optional(),
  }),
  output: z.object({
    classifiedCount: z.number(),
  }),
  run: async (step, input) => {
    const orgId = input.organizationId as OrganizationId

    const result = await step.run('classify', async () => {
      step.progress(0, 0, 'Classifying PRs...')
      return await classifyPullRequests(orgId, {
        force: input.force,
        limit: input.limit,
      })
    })

    clearOrgCache(orgId)

    return { classifiedCount: result.classifiedCount }
  },
})
