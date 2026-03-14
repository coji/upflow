import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { verifyAccessToken } from 'better-auth/oauth2'
import { db } from '~/app/services/db.server'
import { createMcpServer } from '~/app/services/mcp/server'
import type { OrganizationId } from '~/app/types/organization'
import type { Route } from './+types/api.mcp'

/**
 * Bearer token から organizationId を解決する。
 * JWT トークンを verifyAccessToken で検証し、userId から org を特定。
 */
const resolveOrgId = async (
  request: Request,
): Promise<OrganizationId | null> => {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null

  try {
    const origin = new URL(request.url).origin
    const payload = await verifyAccessToken(token, {
      jwksUrl: `${origin}/api/auth/jwks`,
      verifyOptions: {
        issuer: `${origin}/api/auth`,
        audience: origin,
      },
    })
    if (!payload?.sub) return null

    // ユーザーの所属 org を取得（暫定: 最初の org）
    const membership = await db
      .selectFrom('members')
      .select(['organizationId'])
      .where('userId', '=', payload.sub)
      .executeTakeFirst()

    return (membership?.organizationId as OrganizationId) ?? null
  } catch {
    return null
  }
}

// セッション管理: stateless モード
const createTransport = () =>
  new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

// POST: JSON-RPC リクエスト
export const action = async ({ request }: Route.ActionArgs) => {
  const orgId = await resolveOrgId(request)
  if (!orgId) {
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate':
          'Bearer resource_metadata="/.well-known/oauth-protected-resource"',
      },
    })
  }

  const transport = createTransport()
  const server = createMcpServer(orgId)
  await server.connect(transport)
  return transport.handleRequest(request)
}

// GET: SSE ストリーム
export const loader = async ({ request }: Route.LoaderArgs) => {
  const orgId = await resolveOrgId(request)
  if (!orgId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const transport = createTransport()
  const server = createMcpServer(orgId)
  await server.connect(transport)
  return transport.handleRequest(request)
}
