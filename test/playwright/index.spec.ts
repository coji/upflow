import { test, expect } from '@playwright/test'
import { hello } from '~/support/helper'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  hello()
})

test('"UpFlow"タイトル表示', async ({ page }) => {
  const title = page.locator('text=UpFlow')
  await expect(title).toHaveText('UpFlow')
})

test.skip('ログインして admin 画面に遷移', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Eメール').fill('user@example.com')
  await page.getByLabel('パスワード').fill('realygoodpassword')
  await page.getByRole('button', { name: 'ログイン' }).click()
  await page.waitForNavigation({ url: '/admin', timeout: 1000 })
  await expect(page.url().substring(page.url().lastIndexOf('/'))).toEqual('/admin')
})
