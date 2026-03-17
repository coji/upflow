import { defineJob } from '@coji/durably'
import { z } from 'zod'
import { clearOrgCache } from '~/app/services/cache.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { getOrganization } from '~/batch/db/queries'
import { createFetcher } from '~/batch/github/fetcher'
import { createStore } from '~/batch/github/store'
import { analyzeAndFinalizeSteps } from './shared-steps.server'

export const crawlJob = defineJob({
  name: 'crawl',
  input: z.object({
    organizationId: z.string(),
    refresh: z.boolean().default(false),
  }),
  output: z.object({
    fetchedRepos: z.number(),
    pullCount: z.number(),
  }),
  run: async (step, input) => {
    const orgId = input.organizationId as OrganizationId

    // Step 1: Load organization data (token excluded from step output to avoid persisting secrets)
    const organization = await step.run('load-organization', async () => {
      const org = await getOrganization(orgId)
      if (!org.organizationSetting) {
        throw new Error('No organization setting configured')
      }
      if (!org.integration?.privateToken) {
        throw new Error('No integration or token configured')
      }
      return {
        organizationSetting: org.organizationSetting,
        repositories: org.repositories,
        exportSetting: org.exportSetting,
      }
    })

    // Load token separately (not persisted in step output)
    const org = await getOrganization(orgId)
    const token = org.integration?.privateToken
    if (!token) throw new Error('No integration token')

    const repoCount = organization.repositories.length
    const updatedPrNumbers = new Map<string, Set<number>>()

    // Step 2: Fetch per repo
    for (let i = 0; i < organization.repositories.length; i++) {
      const repo = organization.repositories[i]
      const repoLabel = `${repo.owner}/${repo.repo}`

      const store = createStore({
        organizationId: orgId,
        repositoryId: repo.id,
      })
      const fetcher = createFetcher({
        owner: repo.owner,
        repo: repo.repo,
        token,
      })

      // Step 2a: Fetch tags (if tag-based release detection)
      if (repo.releaseDetectionMethod === 'tags') {
        await step.run(`fetch-tags:${repoLabel}`, async () => {
          step.progress(i + 1, repoCount, `Fetching tags: ${repoLabel}...`)
          const allTags = await fetcher.tags()
          await store.saveTags(allTags)
          return { tagCount: allTags.length }
        })
      }

      // Step 2b: Fetch PR list
      const allPullRequests = await step.run(
        `fetch-prs:${repoLabel}`,
        async () => {
          step.progress(i + 1, repoCount, `Fetching PR list: ${repoLabel}...`)
          return await fetcher.pullrequests()
        },
      )

      // Determine which PRs need detail fetching (cached for deterministic resume)
      const lastFetchedAt = await step.run(
        `last-fetched-at:${repoLabel}`,
        async () => {
          if (input.refresh) return '2000-01-01T00:00:00Z'
          return (
            (await store.getLatestUpdatedAt().catch(() => null)) ??
            '2000-01-01T00:00:00Z'
          )
        },
      )

      const prsToFetch = input.refresh
        ? allPullRequests
        : allPullRequests.filter((pr) => pr.updatedAt > lastFetchedAt)

      // Step 2c: Fetch details per PR
      const repoUpdated = new Set<number>()
      for (let j = 0; j < prsToFetch.length; j++) {
        const pr = prsToFetch[j]
        const saved = await step.run(
          `fetch-pr:${repoLabel}:#${pr.number}`,
          async () => {
            step.progress(
              j + 1,
              prsToFetch.length,
              `Fetching ${repoLabel}#${pr.number} (${j + 1}/${prsToFetch.length})...`,
            )
            try {
              const [commits, discussions, reviews, timelineItems, files] =
                await Promise.all([
                  fetcher.commits(pr.number),
                  fetcher.comments(pr.number),
                  fetcher.reviews(pr.number),
                  fetcher.timelineItems(pr.number),
                  fetcher.files(pr.number),
                ])
              pr.files = files
              await store.savePrData(pr, {
                commits,
                reviews,
                discussions,
                timelineItems,
              })
              return { saved: true as const, number: pr.number }
            } catch (e) {
              step.log.warn(
                `Failed to fetch ${repoLabel}#${pr.number}: ${e instanceof Error ? e.message : e}`,
              )
              return { saved: false as const, number: pr.number }
            }
          },
        )
        if (saved.saved) {
          repoUpdated.add(saved.number)
        }
      }

      if (repoUpdated.size > 0) {
        updatedPrNumbers.set(repo.id, repoUpdated)
      }
    }

    // Skip analyze if no updates (and not a refresh)
    if (!input.refresh && updatedPrNumbers.size === 0) {
      step.log.info('No updated PRs, skipping analyze.')
      await step.run('finalize', () => {
        clearOrgCache(orgId)
      })
      return { fetchedRepos: repoCount, pullCount: 0 }
    }

    // Consume refresh flag
    if (input.refresh) {
      await step.run('consume-refresh-flag', async () => {
        const tenantDb = getTenantDb(orgId)
        await tenantDb
          .updateTable('organizationSettings')
          .set({ refreshRequestedAt: null })
          .execute()
      })
    }

    // Steps 3-7: Analyze → Upsert → Classify → Export → Finalize
    const { pullCount } = await analyzeAndFinalizeSteps(
      step,
      orgId,
      organization,
      {
        filterPrNumbers: input.refresh ? undefined : updatedPrNumbers,
        skipRepo: input.refresh
          ? undefined
          : (repoId) => !updatedPrNumbers.has(repoId),
      },
    )

    return { fetchedRepos: repoCount, pullCount }
  },
})
