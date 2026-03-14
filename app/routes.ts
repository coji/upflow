import { route, type RouteConfig } from '@react-router/dev/routes'
import { autoRoutes } from 'react-router-auto-routes'

export default [
  // MCP OAuth discovery endpoints
  route(
    '.well-known/oauth-protected-resource',
    'well-known-routes/oauth-protected-resource.ts',
  ),
  route(
    '.well-known/oauth-authorization-server',
    'well-known-routes/oauth-authorization-server.ts',
  ),

  // File-based routes
  ...autoRoutes({
    ignoredRouteFiles: ['**/*.test.{ts,tsx}'],
  }),
] satisfies RouteConfig
