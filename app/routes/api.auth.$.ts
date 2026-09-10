import { auth } from '~/app/libs/auth.server'
import {
  clearHandoffCookie,
  runWithGithubHandoff,
} from '~/app/libs/github-handoff-auth.server'
import type { Route } from './+types/api.auth.$'

export const loader = async ({ request, url }: Route.LoaderArgs) => {
  const response = await runWithGithubHandoff(request, () =>
    auth.handler(request),
  )
  if (url.pathname.endsWith('/callback/github')) {
    const headers = new Headers(response.headers)
    headers.append('Set-Cookie', clearHandoffCookie())
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
  return response
}

export const action = async ({ request }: Route.ActionArgs) => {
  return await runWithGithubHandoff(request, () => auth.handler(request))
}
