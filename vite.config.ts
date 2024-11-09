import { vitePlugin as remix } from '@remix-run/dev'
import { remixRoutes } from 'remix-routes/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

declare module '@remix-run/server-runtime' {
  interface Future {
    v3_singleFetch: true
  }
}

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
        v3_singleFetch: true,
        unstable_optimizeDeps: true,
        unstable_routeConfig: true,
      },
    }),
    remixRoutes(),
    tsconfigPaths(),
  ],
})
