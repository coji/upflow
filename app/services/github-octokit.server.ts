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

export type IntegrationAuth =
  | { method: 'token'; privateToken: string }
  | { method: 'github_app'; installationId: number }

export type OrgGithubAuthInput = {
  integration:
    | { method: string; privateToken: string | null }
    | null
    | undefined
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
 * durably step 内で呼べる。Octokit は作らず、ユーザー向けエラーのみ投げる。
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
 * org の integration + githubAppLink から Octokit を生成する。
 * method 分岐・エラー判定を1箇所に集約。
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
    return createOctokit({
      method: 'github_app',
      installationId: githubAppLink.installationId,
    })
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
