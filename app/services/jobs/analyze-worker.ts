/**
 * Worker thread for CPU-intensive PR analysis.
 *
 * IMPORTANT: module.register() must be called before any ~/... imports.
 */
if (import.meta.url.endsWith('.ts')) {
  const { register } = await import('node:module')
  register('./path-alias-hooks.mjs', import.meta.url)
}

import 'dotenv/config'
import { parentPort, workerData } from 'node:worker_threads'
import type { OrganizationId } from '~/app/types/organization'

interface WorkerInput {
  organizationId: string
  repositoryId: string
  releaseDetectionMethod: string
  releaseDetectionKey: string
  botLogins: string[]
  filterPrNumbers?: number[]
}

const input = workerData as WorkerInput
const orgId = input.organizationId as OrganizationId

const [{ buildPullRequests }, { createStore }] = (await Promise.all([
  import('~/batch/github/pullrequest'),
  import('~/batch/github/store'),
])) as [
  {
    buildPullRequests: typeof import('~/batch/github/pullrequest').buildPullRequests
  },
  { createStore: typeof import('~/batch/github/store').createStore },
]

const store = createStore({
  organizationId: orgId,
  repositoryId: input.repositoryId,
})
store.preloadAll()

const result: Awaited<ReturnType<typeof buildPullRequests>> =
  await buildPullRequests(
    {
      organizationId: orgId,
      repositoryId: input.repositoryId,
      releaseDetectionMethod: input.releaseDetectionMethod,
      releaseDetectionKey: input.releaseDetectionKey,
      botLogins: new Set(input.botLogins),
    },
    await store.loader.pullrequests(),
    store.loader,
    input.filterPrNumbers ? new Set(input.filterPrNumbers) : undefined,
  )

parentPort?.postMessage(result)
