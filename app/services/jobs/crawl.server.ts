import { defineJob } from '@coji/durably'
import { z } from 'zod'
import { getErrorMessageForLog } from '~/app/libs/error-message'
import { clearOrgCache } from '~/app/services/cache.server'
import {
  assertOrgGithubAuthResolvable,
  resolveOctokitFromOrg,
} from '~/app/services/github-octokit.server'
import { processConcurrencyKey } from '~/app/services/jobs/concurrency-keys.server'
import { shouldTriggerFullOrgProcessJob } from '~/app/services/jobs/crawl-process-handoff.server'
import type { OrganizationId } from '~/app/types/organization'
import { getOrganization } from '~/batch/db/queries'
import {
  createFetcher,
  GraphQLResourceMissingError,
} from '~/batch/github/fetcher'
import { createStore } from '~/batch/github/store'
import { computeAdvancedScanWatermark } from './scan-watermark'

export const crawlJob = defineJob({
  name: 'crawl',
  input: z.object({
    organizationId: z.string(),
    refresh: z.boolean().default(false),
    prNumbers: z.array(z.number()).optional(),
    repositoryId: z.string().optional(),
  }),
  output: z.object({
    fetchedRepos: z.number(),
    pullCount: z.number(),
    failedRepos: z
      .array(z.object({ repoLabel: z.string(), error: z.string() }))
      .default([]),
  }),
  run: async (step, input) => {
    const orgId = input.organizationId as OrganizationId

    if (input.prNumbers?.length && !input.repositoryId) {
      throw new Error('repositoryId is required when prNumbers is set')
    }

    const fullOrg = await getOrganization(orgId)

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

    const updatedPrNumbers = new Map<string, Set<number>>()
    const failedRepos: Array<{ repoLabel: string; error: string }> = []

    const FETCH_ALL_SENTINEL = '2000-01-01T00:00:00Z'

    const targetRepos = input.repositoryId
      ? organization.repositories.filter((r) => r.id === input.repositoryId)
      : organization.repositories
    if (input.repositoryId && targetRepos.length === 0) {
      throw new Error('repositoryId does not match any organization repository')
    }
    const repoCount = targetRepos.length

    for (let i = 0; i < targetRepos.length; i++) {
      const repo = targetRepos[i]
      const repoLabel = `${repo.owner}/${repo.repo}`

      try {
        const store = createStore({
          organizationId: orgId,
          repositoryId: repo.id,
        })
        const fetcher = createFetcher({
          owner: repo.owner,
          repo: repo.repo,
          octokit,
        })

        // GraphQLResourceMissingError は step.run の外で再 throw する。
        // step.run 内で raw に throw すると durably がリトライしてしまうため、
        // sentinel として返してから外で投げ直し、外側 try/catch で記録する。
        if (repo.releaseDetectionMethod === 'tags') {
          const result = await step.run(`fetch-tags:${repoLabel}`, async () => {
            step.progress(i + 1, repoCount, `Fetching tags: ${repoLabel}...`)
            try {
              const allTags = await fetcher.tags()
              await store.saveTags(allTags)
              return { tagCount: allTags.length, missingMessage: null }
            } catch (e) {
              if (e instanceof GraphQLResourceMissingError) {
                return { tagCount: 0, missingMessage: e.message }
              }
              throw e
            }
          })
          if (result.missingMessage !== null) {
            throw new GraphQLResourceMissingError(result.missingMessage)
          }
        }

        // Watermark bounds full-sweep progress; targeted fetches must not
        // advance it (see computeAdvancedScanWatermark / #278).
        const scanWatermark = input.refresh
          ? FETCH_ALL_SENTINEL
          : (repo.scanWatermark ?? FETCH_ALL_SENTINEL)

        const prNumberSet = input.prNumbers ? new Set(input.prNumbers) : null
        let prsToFetch: Array<{ number: number; updatedAt?: string }>
        if (prNumberSet) {
          prsToFetch = input.prNumbers?.map((n) => ({ number: n })) ?? []
        } else {
          const result = await step.run(`fetch-prs:${repoLabel}`, async () => {
            step.progress(i + 1, repoCount, `Fetching PR list: ${repoLabel}...`)
            const stopBefore =
              input.refresh || scanWatermark === FETCH_ALL_SENTINEL
                ? undefined
                : scanWatermark
            try {
              return {
                prs: await fetcher.pullrequestList(stopBefore),
                missingMessage: null as string | null,
              }
            } catch (e) {
              if (e instanceof GraphQLResourceMissingError) {
                return {
                  prs: [] as Array<{ number: number; updatedAt: string }>,
                  missingMessage: e.message,
                }
              }
              throw e
            }
          })
          if (result.missingMessage !== null) {
            throw new GraphQLResourceMissingError(result.missingMessage)
          }
          prsToFetch = result.prs
        }

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
              const fetchedAt = new Date().toISOString()
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
                const prForSave = { ...prMetadata, files }
                await store.savePrData(
                  prForSave,
                  {
                    commits,
                    reviews,
                    discussions,
                    timelineItems,
                  },
                  fetchedAt,
                )
                return { saved: true as const, number: pr.number }
              } catch (e) {
                step.log.warn(
                  `Failed to fetch ${repoLabel}#${pr.number}: ${getErrorMessageForLog(e)}`,
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

        // Advance the scan watermark only after a fully successful full-sweep.
        // See computeAdvancedScanWatermark for the invariants.
        const nextWatermark = computeAdvancedScanWatermark({
          isTargetedFetch: prNumberSet !== null,
          prsToFetch,
          savedPrNumbers: repoUpdated,
        })
        if (nextWatermark !== null) {
          await step.run(`advance-scan-watermark:${repoLabel}`, async () => {
            await store.setScanWatermark(nextWatermark)
          })
        }
      } catch (e) {
        const message = getErrorMessageForLog(e)
        step.log.error(
          `Failed to crawl ${repoLabel}, skipping remaining steps for this repo: ${message}`,
        )
        failedRepos.push({ repoLabel, error: message })
      }
    }

    if (!input.refresh && !input.prNumbers && updatedPrNumbers.size === 0) {
      step.log.info('No updated PRs, skipping process.')
      await step.run('finalize', () => {
        clearOrgCache(orgId)
      })
      return { fetchedRepos: repoCount, pullCount: 0, failedRepos }
    }

    if (input.prNumbers && updatedPrNumbers.size === 0) {
      step.log.warn(
        `No PRs matched or fetched for requested numbers: ${input.prNumbers.join(', ')}`,
      )
    }

    let pullCount = 0
    for (const set of updatedPrNumbers.values()) {
      pullCount += set.size
    }

    await step.run('trigger-process', async () => {
      const { durably } = await import('~/app/services/durably.server')
      const processOpts = {
        concurrencyKey: processConcurrencyKey(orgId),
        labels: { organizationId: orgId },
        coalesce: 'skip' as const,
      }
      if (
        shouldTriggerFullOrgProcessJob({
          refresh: input.refresh,
          repositoryId: input.repositoryId,
          prNumbers: input.prNumbers,
        })
      ) {
        await durably.jobs.process.trigger(
          { organizationId: orgId },
          processOpts,
        )
      } else {
        const scopes = [...updatedPrNumbers.entries()].map(
          ([repositoryId, set]) => ({
            repositoryId,
            prNumbers: [...set],
          }),
        )
        await durably.jobs.process.trigger(
          { organizationId: orgId, scopes },
          processOpts,
        )
      }
    })

    return { fetchedRepos: repoCount, pullCount, failedRepos }
  },
})
