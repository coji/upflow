import { GoogleStrategy } from '@coji/remix-auth-google'
import invariant from 'tiny-invariant'
import { verifyUser } from './verify-user.server'

invariant(process.env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID is required')
invariant(process.env.GOOGLE_CLIENT_SECRET, 'GOOGLE_CLIENT_SECRET is required')

export const strategy = new GoogleStrategy(
  {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectURI: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://upflow.team'}/auth/google/callback`,
  },
  verifyUser,
)
