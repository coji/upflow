import { createCookieSessionStorage } from '@remix-run/node'
import { Authenticator } from 'remix-auth'
import invariant from 'tiny-invariant'
import type { SessionUser } from '../types/types'
import { strategy as GoogleStrategy } from './google-auth.server'

invariant(process.env.SESSION_SECRET, 'SESSION_SECRET environment variable should defined')

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === 'production',
  },
})

export const authenticator = new Authenticator<SessionUser>(sessionStorage)
authenticator.use(GoogleStrategy, 'google')
