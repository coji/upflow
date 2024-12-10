import type { LoaderFunctionArgs } from 'react-router'
import { authenticator } from '~/app/features/auth/services/authenticator.server'

export const loader = async ({ request }: LoaderFunctionArgs) =>
  await authenticator.authenticate('google', request)
