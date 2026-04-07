import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from 'octokit'
import invariant from 'tiny-invariant'

function getAppCredentials(): { appId: number; privateKey: string } {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = Buffer.from(
    process.env.GITHUB_APP_PRIVATE_KEY ?? '',
    'base64',
  ).toString('utf-8')
  invariant(
    appId && privateKey,
    'GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required',
  )
  return { appId: Number(appId), privateKey }
}

/**
 * App-level JWT (no installation). Use for e.g. `GET /app/installations/:id`.
 */
export function createAppOctokit(): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: getAppCredentials(),
  })
}

let cachedAppSlug: string | null = null

/**
 * Get the GitHub App slug (e.g. "upflow-team") via GET /app.
 * Cached in memory after first successful call.
 */
export async function getGithubAppSlug(): Promise<string | null> {
  if (cachedAppSlug) return cachedAppSlug
  try {
    const octokit = createAppOctokit()
    const { data } = await octokit.rest.apps.getAuthenticated()
    cachedAppSlug = data?.slug ?? null
    return cachedAppSlug
  } catch {
    return null
  }
}

export type IntegrationAuth =
  | { method: 'token'; privateToken: string }
  | { method: 'github_app'; installationId: number }

export type IntegrationMethod = 'token' | 'github_app'

export type IntegrationForOctokit = {
  method: IntegrationMethod | (string & {})
  privateToken: string | null
}

export type GithubAppLinkForOctokit = {
  installationId: number
  suspendedAt?: string | null
}

export type RepositoryForOctokit = {
  githubInstallationId: number | null
}

export type OrgGithubAuthInput = {
  integration: IntegrationForOctokit | null | undefined
  githubAppLink: { installationId: number } | null | undefined
}

export function createOctokit(auth: IntegrationAuth): Octokit {
  if (auth.method === 'token') {
    return new Octokit({ auth: auth.privateToken })
  }

  const credentials = getAppCredentials()
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { ...credentials, installationId: auth.installationId },
  })
}

/**
 * Build an Octokit for a specific installation id.
 */
export function resolveOctokitForInstallation(installationId: number): Octokit {
  return createOctokit({ method: 'github_app', installationId })
}

/**
 * Single-link sanity check used by legacy callers that still treat GitHub App
 * as one installation per org. New callers should validate per repository via
 * {@link resolveOctokitForRepository}.
 *
 * @deprecated
 */
export function assertOrgGithubAuthResolvable(org: OrgGithubAuthInput): void {
  const { integration, githubAppLink } = org
  if (!integration) throw new Error('No integration configured')

  if (integration.method === 'github_app') {
    if (!githubAppLink) throw new Error('GitHub App is not connected')
    return
  }

  if (integration.privateToken) return
  throw new Error('No auth configured')
}

/**
 * Resolve Octokit for a single repository.
 *
 * Strict path: when `repository.githubInstallationId` is set, use the matching
 * (non-suspended) GitHub App link.
 *
 * Transitional fallback for `github_app` mode without an explicit installation id:
 *   - exactly 1 active link → use it
 *   - 0 active links → throw (PAT auto-fallback is forbidden by design)
 *   - 2+ active links → throw (ambiguous; requires explicit assignment)
 */
export function resolveOctokitForRepository(input: {
  integration: IntegrationForOctokit | null | undefined
  githubAppLinks: GithubAppLinkForOctokit[]
  repository: RepositoryForOctokit
}): Octokit {
  const { integration, githubAppLinks, repository } = input
  if (!integration) throw new Error('No integration configured')

  if (integration.method === 'github_app') {
    if (repository.githubInstallationId !== null) {
      const matched = githubAppLinks.find(
        (l) => l.installationId === repository.githubInstallationId,
      )
      if (!matched) {
        throw new Error(
          `GitHub App installation ${repository.githubInstallationId} is not active for this organization`,
        )
      }
      if (matched.suspendedAt) {
        throw new Error(
          `GitHub App installation ${repository.githubInstallationId} is suspended`,
        )
      }
      return resolveOctokitForInstallation(matched.installationId)
    }

    const activeLinks = githubAppLinks.filter((l) => !l.suspendedAt)
    if (activeLinks.length === 1) {
      return resolveOctokitForInstallation(activeLinks[0].installationId)
    }
    if (activeLinks.length === 0) {
      throw new Error('GitHub App is not connected')
    }
    throw new Error(
      `Repository has no canonical installation assigned and ${activeLinks.length} active installations exist. Backfill required.`,
    )
  }

  if (integration.privateToken) {
    return createOctokit({
      method: 'token',
      privateToken: integration.privateToken,
    })
  }
  throw new Error('No auth configured')
}

/**
 * org の integration + githubAppLink から Octokit を生成する。
 *
 * @deprecated Use {@link resolveOctokitForRepository} (per-repo) or
 *   {@link resolveOctokitForInstallation} (explicit installation id).
 */
export function resolveOctokitFromOrg(org: OrgGithubAuthInput): Octokit {
  assertOrgGithubAuthResolvable(org)
  const { integration, githubAppLink } = org
  invariant(
    integration,
    'integration must be set after assertOrgGithubAuthResolvable',
  )

  if (integration.method === 'github_app') {
    invariant(
      githubAppLink,
      'githubAppLink must be set for github_app method after assertOrgGithubAuthResolvable',
    )
    return resolveOctokitForInstallation(githubAppLink.installationId)
  }

  invariant(
    integration.privateToken,
    'privateToken must be set for token method after assertOrgGithubAuthResolvable',
  )
  return createOctokit({
    method: 'token',
    privateToken: integration.privateToken,
  })
}
