import type { PlaywrightTestConfig } from '@playwright/test'
import { devices } from '@playwright/test'

const config: PlaywrightTestConfig = {
  testDir: './test/playwright',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: 'PORT=8811 pnpm run start',
    port: 8811,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    actionTimeout: 0,
    baseURL: 'http://localhost:8811',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
}

export default config
