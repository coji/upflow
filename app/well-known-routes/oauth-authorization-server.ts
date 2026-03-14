import { oauthProviderAuthServerMetadata } from '@better-auth/oauth-provider'
import { auth } from '~/app/libs/auth.server'

const handler = oauthProviderAuthServerMetadata(auth)

export const loader = ({ request }: { request: Request }) => {
  return handler(request)
}
