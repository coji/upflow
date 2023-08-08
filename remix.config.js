/* eslint-disable @typescript-eslint/no-var-requires */
const { flatRoutes } = require('remix-flat-routes')

/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  cacheDirectory: './node_modules/.cache/remix',
  ignoredRouteFiles: ['**/*'],
  routes: async (defineRoutes) => {
    return flatRoutes('routes', defineRoutes)
  },
  serverModuleFormat: 'cjs',
  serverDependenciesToBundle: 'all',
  watchPaths: ['tailwind.config.js', 'server.ts'],
  future: {
    v2_errorBoundary: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
    v2_dev: true,
    v2_headers: true,
  },
  tailwind: true,
  postcss: true,
}
