/**
 * Tenant DB types for database-per-tenant architecture.
 * These types mirror the shared type.ts but only include tenant-scoped tables
 * with organizationId columns removed.
 *
 * TODO: Auto-generate this file via kysely-codegen once tenant DB setup is complete.
 */

import type { ColumnType } from 'kysely'

export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>

export interface CompanyGithubUsers {
  createdAt: Generated<string>
  displayName: string
  email: string | null
  login: string
  name: string | null
  pictureUrl: string | null
  updatedAt: string
  userId: string | null
}

export interface ExportSettings {
  clientEmail: string
  createdAt: Generated<string>
  id: string
  privateKey: string
  sheetId: string
  updatedAt: string
}

export interface Integrations {
  id: string
  method: string
  privateToken: string | null
  provider: string
}

export interface OrganizationSettings {
  createdAt: Generated<string>
  excludedUsers: Generated<string>
  id: string
  isActive: Generated<number>
  refreshRequestedAt: string | null
  releaseDetectionKey: Generated<string>
  releaseDetectionMethod: Generated<string>
  updatedAt: string
}

export interface PullRequestReviewers {
  pullRequestNumber: number
  repositoryId: string
  requestedAt: string | null
  reviewer: string
}

export interface PullRequestReviews {
  id: string
  pullRequestNumber: number
  repositoryId: string
  reviewer: string
  state: string
  submittedAt: string
  url: string
}

export interface PullRequests {
  additions: number | null
  author: string
  changedFiles: number | null
  codingTime: number | null
  deletions: number | null
  deployTime: number | null
  firstCommittedAt: string | null
  firstReviewedAt: string | null
  mergedAt: string | null
  number: number
  pickupTime: number | null
  pullRequestCreatedAt: string
  releasedAt: string | null
  repo: string
  repositoryId: string
  reviewTime: number | null
  sourceBranch: string
  state: string
  targetBranch: string
  title: string
  totalTime: number | null
  updatedAt: string | null
  url: string
}

export interface Repositories {
  createdAt: Generated<string>
  id: string
  integrationId: string
  owner: string
  provider: string
  releaseDetectionKey: Generated<string>
  releaseDetectionMethod: Generated<string>
  repo: string
  updatedAt: string
}

export interface DB {
  companyGithubUsers: CompanyGithubUsers
  exportSettings: ExportSettings
  integrations: Integrations
  organizationSettings: OrganizationSettings
  pullRequestReviewers: PullRequestReviewers
  pullRequestReviews: PullRequestReviews
  pullRequests: PullRequests
  repositories: Repositories
}
