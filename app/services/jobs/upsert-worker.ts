/**
 * Worker thread for DB-heavy analyzed-data upsert.
 *
 * IMPORTANT: module.register() must be called before any ~/... imports.
 */
if (import.meta.url.endsWith('.ts')) {
  const { register } = await import('node:module')
  register('./path-alias-hooks.mjs', import.meta.url)
}

import 'dotenv/config'
import type { Selectable } from 'kysely'
import { parentPort, workerData } from 'node:worker_threads'
import type { TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import type { AnalyzedReview, AnalyzedReviewer } from '~/batch/github/types'

interface WorkerInput {
  organizationId: string
  pulls: Selectable<TenantDB.PullRequests>[]
  reviews: AnalyzedReview[]
  reviewers: AnalyzedReviewer[]
}

const input = workerData as WorkerInput

const { upsertAnalyzedData } = await import('~/batch/db')

await upsertAnalyzedData(input.organizationId as OrganizationId, {
  pulls: input.pulls,
  reviews: input.reviews,
  reviewers: input.reviewers,
})

parentPort?.postMessage({ ok: true as const })
