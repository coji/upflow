import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser } from './support'

const testUser = {
  email: 'test@example.com',
  displayName: 'test user',
  pictureUrl: null,
  locale: 'ja',
}

test.beforeAll(async () => {
  await createTestUser(testUser)
})

test.afterAll(async () => {
  await deleteTestUser(testUser.email)
})

test('"UpFlow"タイトル表示', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=UpFlow')).toBeVisible()
})

test('ログインして admin 画面に遷移', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Eメール').fill(testUser.email)
  await page.getByRole('button', { name: 'ログイン' }).click()
  await page.waitForURL('/')

  await expect(page.getByRole('link', { name: 'UpFlow' })).toHaveAttribute('href', '/admin')
  await expect(page.getByText('admin')).toBeVisible()
})
