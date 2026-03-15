import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ mode }) => ({
  server:
    mode !== 'production' &&
    fs.existsSync('.certs/localhost.pem') &&
    fs.existsSync('.certs/localhost-key.pem')
      ? {
          https: {
            cert: '.certs/localhost.pem',
            key: '.certs/localhost-key.pem',
          },
        }
      : undefined,
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths({ ignoreConfigErrors: true }),
    mode !== 'production' && devtoolsJson(),
  ],
}))
