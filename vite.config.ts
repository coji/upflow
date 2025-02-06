import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { safeRoutes } from 'safe-routes/vite'
import {
  defaultClientConditions,
  defaultServerConditions,
  defineConfig,
} from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), safeRoutes(), tsconfigPaths()],
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
