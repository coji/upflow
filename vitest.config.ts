/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/vitest.batch.setup.ts'],
    include: ['**/*.test.ts'],
    environmentOptions: {
      vprisma: {
        baseEnv: 'happy-dom',
      },
    },
  },
})
