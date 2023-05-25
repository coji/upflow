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
  future: {
    v2_errorBoundary: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
  serverDependenciesToBundle: [
    'got',
    '@sindresorhus/is',
    '@szmarczak/http-timer',
    'p-cancelable',
    'lowercase-keys',
    'form-data-encoder',
    'ky',
  ],
}
