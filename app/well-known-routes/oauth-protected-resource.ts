export const loader = ({ request }: { request: Request }) => {
  const origin = new URL(request.url).origin
  return Response.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
  })
}
