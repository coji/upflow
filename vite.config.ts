import { reactRouter } from '@react-router/dev/vite'
import { safeRoutes } from 'safe-routes/vite'
import {
  defaultClientConditions,
  defaultServerConditions,
  defineConfig,
} from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: { port: 3000 },
  plugins: [reactRouter(), safeRoutes(), tsconfigPaths()],
  resolve: { conditions: [...defaultClientConditions] },
  ssr: {
    resolve: { conditions: [...defaultServerConditions] },
    optimizeDeps: {
      include: [
        'react',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom',
        'react-dom/server',
        'react-router',
      ],
    },
  },
})
