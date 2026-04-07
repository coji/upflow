import { defineJob } from '@coji/durably'
import { z } from 'zod'
import { getErrorMessageForLog } from '~/app/libs/error-message'
import { resolveOctokitForRepository } from '~/app/services/github-octokit.server'
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
      if (!fullOrg.integration) {
        throw new Error('No integration configured')
      }
      if (
        fullOrg.integration.method === 'github_app' &&
        fullOrg.githubAppLinks.filter((l) => !l.suspendedAt).length === 0
      ) {
        throw new Error('GitHub App is not connected')
      }
      if (
        fullOrg.integration.method === 'token' &&
        !fullOrg.integration.privateToken
      ) {
        throw new Error('No auth configured')
      }
      return {
        repositories: fullOrg.repositories,
      }
    })

    const repoCount = organization.repositories.length

    for (let i = 0; i < organization.repositories.length; i++) {
      const repository = organization.repositories[i]
      const repoLabel = `${repository.owner}/${repository.repo}`

      await step.run(`backfill:${repoLabel}`, async () => {
        step.progress(i + 1, repoCount, `Backfilling ${repoLabel}...`)
        let octokit: ReturnType<typeof resolveOctokitForRepository>
        try {
          octokit = resolveOctokitForRepository({
            integration: fullOrg.integration,
            githubAppLinks: fullOrg.githubAppLinks,
            repository,
          })
        } catch (e) {
          step.log.warn(`Skipping ${repoLabel}: ${getErrorMessageForLog(e)}`)
          return
        }
        await backfillRepo(orgId, repository, octokit, {
          files: input.files,
        })
      })
    }

    return { repositoryCount: repoCount }
  },
})
