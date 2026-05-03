import { makeSignature } from 'better-auth/crypto'
import { redirect } from 'react-router'
import { auth } from '~/app/libs/auth.server'
import type { Route } from './+types/test-login'

const E2E_ADMIN_EMAIL = 'admin@example.com'

interface CookieAttributes {
  path?: string
  sameSite?: string
  httpOnly?: boolean
  secure?: boolean
  maxAge?: number
}

async function buildSignedSetCookie(
  name: string,
  token: string,
  secret: string,
  attrs: CookieAttributes,
): Promise<string> {
  const value = `${token}.${await makeSignature(token, secret)}`
  const parts = [`${name}=${value}`]
  if (attrs.path) parts.push(`Path=${attrs.path}`)
  if (attrs.httpOnly) parts.push('HttpOnly')
  if (attrs.secure) parts.push('Secure')
  if (attrs.sameSite) {
    // Normalize "lax" / "Lax" → "Lax"; better-auth's type allows either casing.
    const s = attrs.sameSite
    parts.push(`SameSite=${s[0].toUpperCase()}${s.slice(1).toLowerCase()}`)
  }
  if (attrs.maxAge !== undefined) parts.push(`Max-Age=${attrs.maxAge}`)
  return parts.join('; ')
}

export const loader = async ({ request }: Route.LoaderArgs) => {
  const e2eLoginOk =
    process.env.NODE_ENV !== 'production' &&
    process.env.ENABLE_E2E_LOGIN === '1'
  if (!e2eLoginOk) {
    return new Response(null, { status: 404 })
  }

  const url = new URL(request.url)
  if (url.searchParams.get('email') !== E2E_ADMIN_EMAIL) {
    return new Response(null, { status: 404 })
  }

  const ctx = await auth.$context
  const found = await ctx.internalAdapter.findUserByEmail(E2E_ADMIN_EMAIL)
  if (!found) {
    return new Response(null, { status: 404 })
  }

  const session = await ctx.internalAdapter.createSession(found.user.id, false)
  const sessionCookie = ctx.authCookies.sessionToken
  const setCookie = await buildSignedSetCookie(
    sessionCookie.name,
    session.token,
    ctx.secret,
    { ...sessionCookie.attributes, maxAge: ctx.sessionConfig.expiresIn },
  )

  throw redirect('/', { headers: { 'Set-Cookie': setCookie } })
}
