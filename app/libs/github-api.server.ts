const DEFAULT_GITHUB_API_BASE_URL = 'https://api.github.com'

export function getGithubApiBaseUrl(): string {
  return (
    process.env.GITHUB_API_BASE_URL?.trim().replace(/\/+$/, '') ||
    DEFAULT_GITHUB_API_BASE_URL
  )
}

export function githubApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new URL(normalizedPath, `${getGithubApiBaseUrl()}/`).toString()
}
