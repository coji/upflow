/* eslint-disable @typescript-eslint/no-var-requires */
const { flatRoutes } = require('remix-flat-routes')

/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  ignoredRouteFiles: ['**/*'],
  routes: async (defineRoutes) => flatRoutes('routes', defineRoutes),
  serverModuleFormat: 'cjs',
  serverDependenciesToBundle: 'all',
  watchPaths: ['tailwind.config.js', 'server.ts'],
}
