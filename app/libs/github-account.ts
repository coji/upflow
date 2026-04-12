/**
 * Shared formatting / URL helpers for GitHub App installation links.
 */

export type GithubAccountLike = {
  installationId: number
  githubOrg: string
  githubAccountType: string | null
}

export type GithubAccountKind = 'personal' | 'organization' | 'unknown'

/**
 * `github_account_type` is nullable for legacy rows migrated before the
 * column existed; the setup callback / webhooks populate it going forward.
 * Treat unknown values as `'unknown'` so the UI can degrade rather than
 * guessing wrong (e.g. building an `/organizations/...` URL that 404s for
 * a personal account).
 */
export const getAccountKind = (link: GithubAccountLike): GithubAccountKind => {
  if (link.githubAccountType === 'User') return 'personal'
  if (link.githubAccountType === 'Organization') return 'organization'
  return 'unknown'
}

export const isPersonalAccount = (link: GithubAccountLike): boolean =>
  getAccountKind(link) === 'personal'

/**
 * UI label for an installation account. Personal accounts get an `@` prefix
 * (matching GitHub's own convention). Organizations and unknown-kind accounts
 * render the bare login.
 */
export const formatGithubAccountLabel = (link: GithubAccountLike): string =>
  getAccountKind(link) === 'personal' ? `@${link.githubOrg}` : link.githubOrg

/**
 * GitHub-side settings URL for managing this installation. Returns `null`
 * when the account kind is unknown — the UI should skip the link rather
 * than guess and emit a 404.
 *
 * - Personal: `https://github.com/settings/installations/<id>`
 * - Organization: `https://github.com/organizations/<login>/settings/installations`
 */
export const buildInstallationSettingsUrl = (
  link: GithubAccountLike,
): string | null => {
  const kind = getAccountKind(link)
  if (kind === 'personal') {
    return `https://github.com/settings/installations/${link.installationId}`
  }
  if (kind === 'organization') {
    return `https://github.com/organizations/${encodeURIComponent(link.githubOrg)}/settings/installations`
  }
  return null
}
