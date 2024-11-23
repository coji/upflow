import { reactRouter } from '@react-router/dev/vite'
import { remixRoutes } from 'remix-routes/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: { port: 3000 },
  plugins: [reactRouter(), remixRoutes(), tsconfigPaths()],
})
