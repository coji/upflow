import { durablyHandler } from '~/app/services/durably.server'
import type { Route } from './+types/api.durably.$'

export function loader({ request }: Route.LoaderArgs) {
  return durablyHandler.handle(request, '/api/durably')
}

export function action({ request }: Route.ActionArgs) {
  return durablyHandler.handle(request, '/api/durably')
}
