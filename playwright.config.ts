import { defineConfig, devices } from '@playwright/test'
import { adminStorageStatePath } from './test/playwright/fixtures/auth'

export default defineConfig({
  testDir: './test/playwright',
  testMatch: '**/?(*.)+(playwright-test).[tj]s?(x)',
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
    { name: 'setup', testMatch: '**/auth.setup.playwright-test.ts' },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: '**/auth.setup.playwright-test.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminStorageStatePath,
      },
    },
  ],
  webServer: {
    command: 'pnpm run start:e2e',
    port: 8811,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    actionTimeout: 0,
    baseURL: 'http://localhost:8811',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
})
