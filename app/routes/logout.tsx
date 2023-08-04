import type { ActionArgs } from '@remix-run/node'
import { authenticator } from '~/app/features/auth/services/authenticator.server'

export const loader = async ({ request }: ActionArgs) => {
  await authenticator.logout(request, { redirectTo: '/' })
}
