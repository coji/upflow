import { defineJob } from '@coji/durably'
import { z } from 'zod'
import { clearOrgCache } from '~/app/services/cache.server'
import {
  assertOrgGithubAuthResolvable,
  resolveOctokitFromOrg,
} from '~/app/services/github-octokit.server'
import type { OrganizationId } from '~/app/types/organization'
import { getOrganization } from '~/batch/db/queries'
import { createFetcher } from '~/batch/github/fetcher'
import { createStore } from '~/batch/github/store'
import {
  analyzeAndFinalizeSteps,
  triggerClassifyStep,
} from './shared-steps.server'

export const crawlJob = defineJob({
  name: 'crawl',
  input: z.object({
    organizationId: z.string(),
    refresh: z.boolean().default(false),
    prNumbers: z.array(z.number()).optional(),
  }),
  output: z.object({
    fetchedRepos: z.number(),
    pullCount: z.number(),
  }),
  run: async (step, input) => {
    const orgId = input.organizationId as OrganizationId

    // Fetch org once before step (secrets stay outside step output)
    const fullOrg = await getOrganization(orgId)

    // Step 1: Validate and extract serializable org data (no secrets in step output)
    const organization = await step.run('load-organization', () => {
      if (!fullOrg.organizationSetting) {
        throw new Error('No organization setting configured')
      }
      assertOrgGithubAuthResolvable({
        integration: fullOrg.integration,
        githubAppLink: fullOrg.githubAppLink,
      })
      return {
        organizationSetting: fullOrg.organizationSetting,
        botLogins: fullOrg.botLogins,
        repositories: fullOrg.repositories,
        exportSetting: fullOrg.exportSetting,
      }
    })

    const octokit = resolveOctokitFromOrg({
      integration: fullOrg.integration,
      githubAppLink: fullOrg.githubAppLink,
    })

    const repoCount = organization.repositories.length
    const updatedPrNumbers = new Map<string, Set<number>>()

    const FETCH_ALL_SENTINEL = '2000-01-01T00:00:00Z'

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
        octokit,
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

      // Step 2b: Determine lastFetchedAt (before list fetch for early termination)
      const lastFetchedAt = await step.run(
        `last-fetched-at:${repoLabel}`,
        async () => {
          if (input.refresh) return FETCH_ALL_SENTINEL
          return (
            (await store.getLatestUpdatedAt().catch(() => null)) ??
            FETCH_ALL_SENTINEL
          )
        },
      )

      // Step 2c: Fetch lightweight PR list (number + updatedAt only)
      const prNumberSet = input.prNumbers ? new Set(input.prNumbers) : null
      const prsToFetch = prNumberSet
        ? // --pr 指定時: リスト取得をスキップ
          (input.prNumbers?.map((n) => ({ number: n, updatedAt: '' })) ?? [])
        : await step.run(`fetch-prs:${repoLabel}`, async () => {
            step.progress(i + 1, repoCount, `Fetching PR list: ${repoLabel}...`)
            const stopBefore =
              input.refresh || lastFetchedAt === FETCH_ALL_SENTINEL
                ? undefined
                : lastFetchedAt
            return await fetcher.pullrequestList(stopBefore)
          })

      // Step 2d: Fetch details per PR (including PR metadata)
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
              const [
                prMetadata,
                commits,
                discussions,
                reviews,
                timelineItems,
                files,
              ] = await Promise.all([
                fetcher.pullrequest(pr.number),
                fetcher.commits(pr.number),
                fetcher.comments(pr.number),
                fetcher.reviews(pr.number),
                fetcher.timelineItems(pr.number),
                fetcher.files(pr.number),
              ])
              prMetadata.files = files
              await store.savePrData(prMetadata, {
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

    // Skip analyze if no updates (and not a refresh or specific PR fetch)
    if (!input.refresh && !input.prNumbers && updatedPrNumbers.size === 0) {
      step.log.info('No updated PRs, skipping analyze.')
      await step.run('finalize', () => {
        clearOrgCache(orgId)
      })
      return { fetchedRepos: repoCount, pullCount: 0 }
    }

    if (input.prNumbers && updatedPrNumbers.size === 0) {
      step.log.warn(
        `No PRs matched or fetched for requested numbers: ${input.prNumbers.join(', ')}`,
      )
    }

    // Steps 3-6: Analyze → Upsert → Export → Finalize
    const { pullCount } = await analyzeAndFinalizeSteps(
      step,
      orgId,
      organization,
      {
        filterPrNumbers:
          input.refresh && !input.prNumbers ? undefined : updatedPrNumbers,
        skipRepo:
          input.refresh && !input.prNumbers
            ? undefined
            : (repoId) => !updatedPrNumbers.has(repoId),
      },
    )

    // Trigger classify job (fire-and-forget)
    await triggerClassifyStep(step, orgId)

    return { fetchedRepos: repoCount, pullCount }
  },
})
