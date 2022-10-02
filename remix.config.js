/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  cacheDirectory: './node_modules/.cache/remix',
  ignoredRouteFiles: ['**/.*', '**/*.css', '**/*.test.{js,jsx,ts,tsx}'],
  // assetsBuildDirectory: 'public/build',
  // serverBuildPath: 'build/index.js',
  //  server: process.env.NODE_ENV === 'production' ? 'server.ts' : undefined,
  serverDependenciesToBundle: [
    'got',
    '@sindresorhus/is',
    '@szmarczak/http-timer',
    'p-cancelable',
    'lowercase-keys',
    'form-data-encoder',
    'ky'
  ]
}
