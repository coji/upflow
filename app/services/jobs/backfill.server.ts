import { defineJob } from '@coji/durably'
import { z } from 'zod'
import {
  assertOrgGithubAuthResolvable,
  resolveOctokitFromOrg,
} from '~/app/services/github-octokit.server'
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

    // Fetch org once before step (secrets stay outside step output)
    const fullOrg = await getOrganization(orgId)

    const organization = await step.run('load-organization', () => {
      step.progress(0, 0, 'Loading organization...')
      assertOrgGithubAuthResolvable({
        integration: fullOrg.integration,
        githubAppLink: fullOrg.githubAppLink,
      })
      return {
        repositories: fullOrg.repositories,
      }
    })

    const octokit = resolveOctokitFromOrg({
      integration: fullOrg.integration,
      githubAppLink: fullOrg.githubAppLink,
    })

    const repoCount = organization.repositories.length

    for (let i = 0; i < organization.repositories.length; i++) {
      const repository = organization.repositories[i]
      const repoLabel = `${repository.owner}/${repository.repo}`

      await step.run(`backfill:${repoLabel}`, async () => {
        step.progress(i + 1, repoCount, `Backfilling ${repoLabel}...`)
        await backfillRepo(orgId, repository, octokit, {
          files: input.files,
        })
      })
    }

    return { repositoryCount: repoCount }
  },
})
