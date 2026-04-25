import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from 'octokit'
import invariant from 'tiny-invariant'
import { getGithubApiBaseUrl } from '~/app/libs/github-api.server'

const octokitOptions = () => ({
  baseUrl: getGithubApiBaseUrl(),
})

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
    ...octokitOptions(),
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

export function createOctokit(auth: IntegrationAuth): Octokit {
  if (auth.method === 'token') {
    return new Octokit({ ...octokitOptions(), auth: auth.privateToken })
  }

  const credentials = getAppCredentials()
  return new Octokit({
    ...octokitOptions(),
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
 * Resolve Octokit for a single repository.
 *
 * For `github_app` mode the repository must have a canonical
 * `githubInstallationId` matching an active (non-suspended) installation.
 * Repositories with `githubInstallationId === null` are treated as broken and
 * the caller must invoke the `reassign-broken-repositories` recovery path.
 *
 * For `token` mode the stored PAT is required.
 */
export function resolveOctokitForRepository(input: {
  integration: IntegrationForOctokit | null | undefined
  githubAppLinks: GithubAppLinkForOctokit[]
  repository: RepositoryForOctokit
}): Octokit {
  const { integration, githubAppLinks, repository } = input
  if (!integration) throw new Error('No integration configured')

  if (integration.method === 'github_app') {
    if (repository.githubInstallationId === null) {
      throw new Error(
        'Repository has no canonical installation assigned. Run reassign-broken-repositories or reinstall the GitHub App.',
      )
    }
    const matched = githubAppLinks.find(
      (l) => l.installationId === repository.githubInstallationId,
    )
    if (!matched) {
      throw new Error(
        `GitHub App installation ${repository.githubInstallationId} not found in active links for this organization`,
      )
    }
    if (matched.suspendedAt) {
      throw new Error(
        `GitHub App installation ${repository.githubInstallationId} is suspended`,
      )
    }
    return resolveOctokitForInstallation(matched.installationId)
  }

  if (integration.privateToken) {
    return createOctokit({
      method: 'token',
      privateToken: integration.privateToken,
    })
  }
  throw new Error('No auth configured')
}
