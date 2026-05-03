import { test as setup } from '@playwright/test'
import { adminStorageStatePath } from './fixtures/auth'

setup('e2e admin storageState', async ({ page }) => {
  const res = await page.goto(
    `/test-login?email=${encodeURIComponent('admin@example.com')}`,
  )
  if (!res?.ok()) {
    throw new Error(`test-login failed: ${res?.status()}`)
  }
  await page.context().storageState({ path: adminStorageStatePath })
})
