import { defineJob } from '@coji/durably'
import { sql, type Selectable } from 'kysely'
import { z } from 'zod'
import { clearOrgCache } from '~/app/services/cache.server'
import { getTenantDb, type TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import {
  exportPulls,
  exportReviewResponses,
} from '~/batch/bizlogic/export-spreadsheet'
import { upsertAnalyzedData } from '~/batch/db'
import { getOrganization } from '~/batch/db/queries'
import { createFetcher } from '~/batch/github/fetcher'
import { buildPullRequests } from '~/batch/github/pullrequest'
import { createStore } from '~/batch/github/store'
import type {
  AnalyzedReview,
  AnalyzedReviewResponse,
  AnalyzedReviewer,
} from '~/batch/github/types'
import { classifyPullRequests } from '~/batch/usecases/classify-pull-requests'

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

    // Step 1: Load organization data
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
        token: org.integration.privateToken,
      }
    })

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
        token: organization.token,
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

      // Determine which PRs need detail fetching
      const lastFetchedAt = input.refresh
        ? '2000-01-01T00:00:00Z'
        : ((await store.getLatestUpdatedAt().catch(() => null)) ??
          '2000-01-01T00:00:00Z')

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
      // Still finalize
      await step.run('finalize', async () => {
        const tenantDb = getTenantDb(orgId)
        await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(tenantDb)
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

    // Step 3: Analyze repos (per-repository)
    const allPulls: Selectable<TenantDB.PullRequests>[] = []
    const allReviews: AnalyzedReview[] = []
    const allReviewers: AnalyzedReviewer[] = []
    const allReviewResponses: AnalyzedReviewResponse[] = []

    for (let i = 0; i < organization.repositories.length; i++) {
      const repo = organization.repositories[i]
      // Skip repos with no updates (unless refresh)
      if (!input.refresh && !updatedPrNumbers.has(repo.id)) continue

      const result = await step.run(`analyze:${repo.repo}`, async () => {
        step.progress(i + 1, repoCount, `Analyzing ${repo.repo}...`)
        const store = createStore({
          organizationId: orgId,
          repositoryId: repo.id,
        })
        await store.preloadAll()

        const orgSetting = organization.organizationSetting
        const filterPrNumbers = updatedPrNumbers.get(repo.id)
        return await buildPullRequests(
          {
            organizationId: orgId,
            repositoryId: repo.id,
            releaseDetectionMethod:
              repo.releaseDetectionMethod ?? orgSetting.releaseDetectionMethod,
            releaseDetectionKey:
              repo.releaseDetectionKey ?? orgSetting.releaseDetectionKey,
            excludedUsers: orgSetting.excludedUsers,
          },
          await store.loader.pullrequests(),
          store.loader,
          input.refresh ? undefined : filterPrNumbers,
        )
      })
      allPulls.push(...result.pulls)
      allReviews.push(...result.reviews)
      allReviewers.push(...result.reviewers)
      allReviewResponses.push(...result.reviewResponses)
    }

    // Step 4: Upsert
    await step.run('upsert', async () => {
      step.progress(0, 0, 'Upserting to database...')
      await upsertAnalyzedData(orgId, {
        pulls: allPulls,
        reviews: allReviews,
        reviewers: allReviewers,
      })
    })

    // Step 5: Classify
    await step.run('classify', async () => {
      step.progress(0, 0, 'Classifying PRs...')
      await classifyPullRequests(orgId)
    })

    // Step 6: Export
    const { exportSetting } = organization
    if (exportSetting) {
      await step.run('export', async () => {
        step.progress(0, 0, 'Exporting to spreadsheet...')
        try {
          await exportPulls(exportSetting, allPulls)
          await exportReviewResponses(exportSetting, allReviewResponses)
        } catch (e) {
          step.log.warn(`Export failed: ${e instanceof Error ? e.message : e}`)
        }
      })
    }

    // Step 7: Finalize
    await step.run('finalize', async () => {
      step.progress(0, 0, 'Finalizing...')
      const tenantDb = getTenantDb(orgId)
      await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(tenantDb)
      clearOrgCache(orgId)
    })

    return { fetchedRepos: repoCount, pullCount: allPulls.length }
  },
})
