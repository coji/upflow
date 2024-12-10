import { Authenticator } from 'remix-auth'
import type { SessionUser } from '../types/types'
import { strategy as GoogleStrategy } from './google-auth/google-auth.server'

export const authenticator = new Authenticator<SessionUser>()
authenticator.use(GoogleStrategy, 'google')
