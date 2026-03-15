import { auth } from '~/app/libs/auth.server'
import type { Route } from './+types/api.auth.$'

/**
 * MCP クライアント（Claude 等）は DCR で client_secret_post を要求するが、
 * MCP 仕様上は public client であるべき。token_endpoint_auth_method を
 * "none" に書き換えて public client として登録する。
 */
const normalizeRegisterRequest = async (request: Request): Promise<Request> => {
  const url = new URL(request.url)
  if (request.method !== 'POST' || !url.pathname.endsWith('/oauth2/register')) {
    return request
  }

  const body = await request.json()
  if (
    body.token_endpoint_auth_method &&
    body.token_endpoint_auth_method !== 'none'
  ) {
    body.token_endpoint_auth_method = 'none'
  }

  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(body),
  })
}

export const loader = async ({ request }: Route.LoaderArgs) => {
  return await auth.handler(request)
}

export const action = async ({ request }: Route.ActionArgs) => {
  const normalized = await normalizeRegisterRequest(request)
  return await auth.handler(normalized)
}
