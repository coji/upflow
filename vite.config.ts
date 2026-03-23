import { reactRouter } from '@react-router/dev/vite'
import { sentryReactRouter } from '@sentry/react-router'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'

export default defineConfig(async (configEnv) => {
  const { mode } = configEnv
  const publishRelease = process.env.SENTRY_PUBLISH_RELEASE === '1'

  return {
    build: {
      sourcemap: 'hidden' as const,
    },

    resolve: {
      tsconfigPaths: true,
    },

    plugins: [
      tailwindcss(),
      reactRouter(),
      mode !== 'production' && devtoolsJson(),
      ...(publishRelease
        ? await sentryReactRouter(
            {
              org: 'techtalkjp',
              project: 'upflow',
              authToken: process.env.SENTRY_AUTH_TOKEN,
            },
            configEnv,
          )
        : []),
    ],

    optimizeDeps: {
      exclude: ['@sentry/react-router'],
    },
  }
})
