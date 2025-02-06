import { GoogleStrategy } from '@coji/remix-auth-google'
import { verifyUser } from './verify-user.server'

export const strategy = new GoogleStrategy(
  {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectURI: `${process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : 'https://upflow.team'}/auth/google/callback`,
  },
  verifyUser,
)
