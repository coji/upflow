import { vitePlugin as remix } from '@remix-run/dev'
import { installGlobals } from '@remix-run/node'
import { flatRoutes } from 'remix-flat-routes'
import { remixRoutes } from 'remix-routes/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

installGlobals({ nativeFetch: true })

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    remix({
      ignoredRouteFiles: ['**/*'],
      routes: (defineRoutes) => flatRoutes('routes', defineRoutes),
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        unstable_singleFetch: true,
        unstable_fogOfWar: true,
      },
    }),
    remixRoutes(),
    tsconfigPaths(),
  ],
})
