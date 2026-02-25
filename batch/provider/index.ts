import { match } from 'ts-pattern'
import type { DB, Selectable } from '~/app/services/db.server'
import { createGitHubProvider } from './github/provider'

/** Provider が提供する機能の契約 */
export interface Provider {
  fetch: (
    repository: Selectable<DB.Repositories>,
    options: { refresh?: boolean; halt?: boolean },
  ) => Promise<void>

  analyze: (
    organizationSetting: Pick<
      Selectable<DB.OrganizationSettings>,
      'releaseDetectionMethod' | 'releaseDetectionKey' | 'excludedUsers'
    >,
    repositories: Selectable<DB.Repositories>[],
    onProgress?: (progress: {
      repo: string
      current: number
      total: number
    }) => void,
  ) => Promise<{
    pulls: Selectable<DB.PullRequests>[]
    reviews: {
      id: string
      pullRequestNumber: number
      repositoryId: string
      reviewer: string
      state: string
      submittedAt: string
      url: string
    }[]
    reviewers: {
      pullRequestNumber: number
      repositoryId: string
      reviewerLogins: string[]
    }[]
    reviewResponses: {
      repo: string
      number: string
      author: string
      createdAt: string
      responseTime: number
    }[]
  }>
}

export const createProvider = (
  integration: Selectable<DB.Integrations>,
): Provider | null =>
  match(integration.provider)
    .with('github', () => createGitHubProvider(integration))
    .otherwise(() => null)
