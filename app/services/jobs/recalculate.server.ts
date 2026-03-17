import { defineJob } from '@coji/durably'
import { sql } from 'kysely'
import { z } from 'zod'
import { clearAllCache } from '~/app/services/cache.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import {
  exportPulls,
  exportReviewResponses,
} from '~/batch/bizlogic/export-spreadsheet'
import {
  batchUpsertPullRequestReviews,
  batchUpsertPullRequests,
  upsertCompanyGithubUsers,
  upsertPullRequestReviewers,
} from '~/batch/db'
import { getOrganization } from '~/batch/db/queries'
import { buildPullRequests } from '~/batch/github/pullrequest'
import { createStore } from '~/batch/github/store'
import type {
  AnalyzedReview,
  AnalyzedReviewResponse,
  AnalyzedReviewer,
} from '~/batch/github/types'
import { classifyPullRequests } from '~/batch/usecases/classify-pull-requests'

const stepsSchema = z.object({
  upsert: z.boolean(),
  classify: z.boolean(),
  export: z.boolean(),
})

export const recalculateJob = defineJob({
  name: 'recalculate',
  input: z.object({
    organizationId: z.string(),
    steps: stepsSchema,
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
      // Return serializable subset
      return {
        organizationSetting: org.organizationSetting,
        repositories: org.repositories,
        exportSetting: org.exportSetting,
      }
    })

    // Step 2: Analyze repos (per-repository steps)
    const repoCount = organization.repositories.length
    const allPulls: unknown[] = []
    const allReviews: AnalyzedReview[] = []
    const allReviewers: AnalyzedReviewer[] = []
    const allReviewResponses: AnalyzedReviewResponse[] = []

    for (let i = 0; i < organization.repositories.length; i++) {
      const repo = organization.repositories[i]
      const result = await step.run(`analyze:${repo.repo}`, async () => {
        step.progress(i + 1, repoCount, `Analyzing ${repo.repo}...`)

        const store = createStore({
          organizationId: orgId,
          repositoryId: repo.id,
        })
        await store.preloadAll()

        const orgSetting = organization.organizationSetting
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
        )
      })
      allPulls.push(...result.pulls)
      allReviews.push(...result.reviews)
      allReviewers.push(...result.reviewers)
      allReviewResponses.push(...result.reviewResponses)
    }

    // Step 3: Upsert to DB (conditional)
    if (input.steps.upsert) {
      await step.run('upsert', async () => {
        step.progress(0, 0, 'Upserting to database...')

        // Auto-register discovered GitHub users
        const discoveredLogins = new Set<string>()
        for (const pr of allPulls as { author?: string }[]) {
          if (pr.author) discoveredLogins.add(pr.author)
        }
        for (const review of allReviews) {
          if (review.reviewer) discoveredLogins.add(review.reviewer)
        }
        for (const reviewer of allReviewers) {
          for (const r of reviewer.reviewers) {
            if (r.login) discoveredLogins.add(r.login)
          }
        }
        await upsertCompanyGithubUsers(orgId, [...discoveredLogins])

        // Upsert pull requests
        await batchUpsertPullRequests(orgId, allPulls as never[])

        // Upsert reviews
        await batchUpsertPullRequestReviews(
          orgId,
          allReviews.map((r) => ({
            id: r.id,
            pullRequestNumber: r.pullRequestNumber,
            repositoryId: r.repositoryId,
            reviewer: r.reviewer,
            state: r.state,
            submittedAt: r.submittedAt,
            url: r.url,
          })),
        )

        // Upsert reviewers
        for (const reviewer of allReviewers) {
          await upsertPullRequestReviewers(
            orgId,
            reviewer.repositoryId,
            reviewer.pullRequestNumber,
            reviewer.reviewers,
          )
        }
      })
    }

    // Step 4: Classify with LLM (conditional)
    if (input.steps.classify) {
      await step.run('classify', async () => {
        step.progress(0, 0, 'Classifying PRs...')
        await classifyPullRequests(orgId)
      })
    }

    // Step 5: Export to spreadsheet (conditional)
    const { exportSetting } = organization
    if (input.steps.export && exportSetting) {
      await step.run('export', async () => {
        step.progress(0, 0, 'Exporting to spreadsheet...')
        await exportPulls(exportSetting, allPulls as never[])
        await exportReviewResponses(exportSetting, allReviewResponses)
      })
    }

    // Step 6: WAL checkpoint + cache clear
    await step.run('finalize', async () => {
      step.progress(0, 0, 'Finalizing...')
      const tenantDb = getTenantDb(orgId)
      await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(tenantDb)
      clearAllCache()
    })

    return { pullCount: allPulls.length }
  },
})
