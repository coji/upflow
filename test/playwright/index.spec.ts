import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser } from '../support'

const testUser = {
  email: 'test@example.com',
  password: 'realysecurepassword'
}

test.beforeAll(async () => {
  await createTestUser(testUser.email, testUser.password)
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
  await page.getByLabel('パスワード').fill(testUser.password)
  await page.getByRole('button', { name: 'ログイン' }).click()
  await page.waitForNavigation({ url: '/admin' })

  await expect(page.getByRole('link', { name: 'UpFlow' })).toHaveAttribute('href', '/admin')
  await expect(page.getByText('admin')).toBeVisible()
})
