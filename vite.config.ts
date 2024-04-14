import { vitePlugin as remix } from '@remix-run/dev'
import { installGlobals } from '@remix-run/node'
import { flatRoutes } from 'remix-flat-routes'
import { remixRoutes } from 'remix-routes/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

installGlobals()

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    remix({
      ignoredRouteFiles: ['**/*'],
      routes: async (defineRoutes) => flatRoutes('routes', defineRoutes),
    }),
    remixRoutes(),
    tsconfigPaths(),
  ],
  optimizeDeps: { exclude: ['@mapbox/node-pre-gyp'] },
})
