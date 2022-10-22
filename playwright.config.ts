import type { PlaywrightTestConfig } from '@playwright/test'
import { devices } from '@playwright/test'

// require('dotenv').config();
const config: PlaywrightTestConfig = {
  testDir: './test/playwright',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],
  webServer: {
    command: 'PORT=8811 npm run dev',
    port: 8811
  },
  use: {
    actionTimeout: 0,
    baseURL: 'http://localhost:8811',
    trace: 'on-first-retry',
    video: 'on-first-retry'
  }
}

export default config
