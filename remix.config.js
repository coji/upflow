/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  ignoredRouteFiles: ['**/.*'],
  assetsBuildDirectory: 'public/build',
  serverBuildPath: 'build/index.js'
  //  server: process.env.NODE_ENV === 'production' ? 'server.js' : undefined,
  //  cacheDirectory: './node_modules/.cache/remix',
  //  ignoredRouteFiles: ['**/.*', '**/*.css', '**/*.test.{js,jsx,ts,tsx}'],
  //  serverDependenciesToBundle: ['globby', 'slash']
}
