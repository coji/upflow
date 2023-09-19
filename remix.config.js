/* eslint-disable @typescript-eslint/no-var-requires */
import { flatRoutes } from 'remix-flat-routes'

/**
 * @type {import('@remix-run/dev').AppConfig}
 */
export default {
  ignoredRouteFiles: ['**/*'],
  routes: async (defineRoutes) => flatRoutes('routes', defineRoutes),
  serverModuleFormat: 'esm',
  serverPlatform: 'node',
  watchPaths: ['tailwind.config.js', 'server.ts'],
}
