/**
 * Shared formatting / URL helpers for GitHub App installation links.
 */

export type GithubAccountLike = {
  installationId: number
  githubOrg: string
  githubAccountType: string | null
}

export const isPersonalAccount = (link: GithubAccountLike): boolean =>
  link.githubAccountType === 'User'

/**
 * UI label for an installation account. Personal accounts get an `@` prefix
 * (matching GitHub's own convention) while organizations show their bare login.
 */
export const formatGithubAccountLabel = (link: GithubAccountLike): string =>
  isPersonalAccount(link) ? `@${link.githubOrg}` : link.githubOrg

/**
 * GitHub-side settings URL for managing this installation.
 *
 * - Personal: `https://github.com/settings/installations/<id>`
 * - Organization: `https://github.com/organizations/<login>/settings/installations`
 */
export const buildInstallationSettingsUrl = (
  link: GithubAccountLike,
): string =>
  isPersonalAccount(link)
    ? `https://github.com/settings/installations/${link.installationId}`
    : `https://github.com/organizations/${encodeURIComponent(link.githubOrg)}/settings/installations`
