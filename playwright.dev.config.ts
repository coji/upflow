import type { PlaywrightTestConfig } from '@playwright/test'
import config from './playwright.config'

const devConfig: PlaywrightTestConfig = {
  ...config,
  webServer: {
    command: 'PORT=8811 pnpm run dev:server',
    port: 8811,
    reuseExistingServer: !process.env.CI,
  },
}

export default devConfig
