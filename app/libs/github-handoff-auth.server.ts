import { AsyncLocalStorage } from 'node:async_hooks'

const COOKIE_NAME = 'upflow_github_handoff'
const handoffState = new AsyncLocalStorage<string | null>()

function readCookie(request: Request): string | null {
  const value = (request.headers.get('Cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1)
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export function handoffCookieForRedirect(redirectTo: string): string | null {
  const url = new URL(redirectTo, 'http://upflow.local')
  if (
    url.pathname !== '/api/github/install' &&
    url.pathname !== '/api/github/setup'
  ) {
    return null
  }
  const state = url.searchParams.get('state')?.trim()
  if (!state) return null
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${encodeURIComponent(state)}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=3600${secure}`
}

export function clearHandoffCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

export function runWithGithubHandoff<T>(
  request: Request,
  callback: () => Promise<T>,
): Promise<T> {
  return handoffState.run(readCookie(request), callback)
}

export function getGithubHandoffState(): string | null {
  return handoffState.getStore() ?? null
}
