import { vitePlugin as remix } from '@remix-run/dev'
import { installGlobals } from '@remix-run/node'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
import remixConfig from './remix.config'

installGlobals()

export default defineConfig({
  server: { port: 3000 },
  plugins: [remix(remixConfig), tsconfigPaths()],
  optimizeDeps: { exclude: ['@mapbox/node-pre-gyp'] },
})
