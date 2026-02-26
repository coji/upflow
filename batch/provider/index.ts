import type { Selectable } from 'kysely'
import { match } from 'ts-pattern'
import type { TenantDB } from '~/app/services/tenant-db.server'
import { createGitHubProvider } from './github/provider'

/** Repository with organizationId (added back by getTenantData for batch compatibility) */
type RepositoryWithOrg = Selectable<TenantDB.Repositories> & {
  organizationId: string
}

/** Provider が提供する機能の契約 */
export interface Provider {
  fetch: (
    repository: RepositoryWithOrg,
    options: { refresh?: boolean; halt?: boolean },
  ) => Promise<void>

  analyze: (
    organizationSetting: Pick<
      Selectable<TenantDB.OrganizationSettings>,
      'releaseDetectionMethod' | 'releaseDetectionKey' | 'excludedUsers'
    >,
    repositories: RepositoryWithOrg[],
    onProgress?: (progress: {
      repo: string
      current: number
      total: number
    }) => void,
  ) => Promise<{
    pulls: Selectable<TenantDB.PullRequests>[]
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
  integration: Selectable<TenantDB.Integrations>,
): Provider | null =>
  match(integration.provider)
    .with('github', () => createGitHubProvider(integration))
    .otherwise(() => null)
