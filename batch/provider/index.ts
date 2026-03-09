import type { Selectable } from 'kysely'
import { match } from 'ts-pattern'
import type { TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { createGitHubProvider } from './github/provider'

/** Provider が提供する機能の契約 */
export interface Provider {
  fetch: (
    organizationId: OrganizationId,
    repository: Selectable<TenantDB.Repositories>,
    options: { refresh?: boolean; halt?: boolean },
  ) => Promise<void>

  /** PR メタデータだけを再取得して raw データを更新する（軽量 backfill） */
  backfill: (
    organizationId: OrganizationId,
    repository: Selectable<TenantDB.Repositories>,
    options?: { files?: boolean },
  ) => Promise<void>

  analyze: (
    organizationId: OrganizationId,
    organizationSetting: Pick<
      Selectable<TenantDB.OrganizationSettings>,
      'releaseDetectionMethod' | 'releaseDetectionKey' | 'excludedUsers'
    >,
    repositories: Selectable<TenantDB.Repositories>[],
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
      state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
      submittedAt: string
      url: string
    }[]
    reviewers: {
      pullRequestNumber: number
      repositoryId: string
      reviewers: { login: string; requestedAt: string | null }[]
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
