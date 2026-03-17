import { defineJob } from '@coji/durably'
import { z } from 'zod'
import type { OrganizationId } from '~/app/types/organization'
import { getOrganization } from '~/batch/db/queries'
import { backfillRepo } from '~/batch/github/backfill-repo'

export const backfillJob = defineJob({
  name: 'backfill',
  input: z.object({
    organizationId: z.string(),
    files: z.boolean().default(false),
  }),
  output: z.object({
    repositoryCount: z.number(),
  }),
  run: async (step, input) => {
    const orgId = input.organizationId as OrganizationId

    const organization = await step.run('load-organization', async () => {
      step.progress(0, 0, 'Loading organization...')
      const org = await getOrganization(orgId)
      if (!org.integration?.privateToken) {
        throw new Error('No integration or token configured')
      }
      return {
        repositories: org.repositories,
      }
    })

    const org = await getOrganization(orgId)
    const token = org.integration?.privateToken
    if (!token) {
      throw new Error('No integration token')
    }

    const repoCount = organization.repositories.length

    for (let i = 0; i < organization.repositories.length; i++) {
      const repository = organization.repositories[i]
      const repoLabel = `${repository.owner}/${repository.repo}`

      await step.run(`backfill:${repoLabel}`, async () => {
        step.progress(i + 1, repoCount, `Backfilling ${repoLabel}...`)
        await backfillRepo(
          orgId,
          repository,
          { privateToken: token },
          {
            files: input.files,
          },
        )
      })
    }

    return { repositoryCount: repoCount }
  },
})
