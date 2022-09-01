import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test.skip('should render "Upflow"', async ({ page }) => {
  const title = page.locator('text=Upflow')
  await expect(title).toHaveText('Upflow')
})

test.skip('should show the login button for the auth page', async ({ page }) => {
  const btnGoToAuthPage = page.locator('.action__auth')
  await expect(btnGoToAuthPage).toBeVisible()
})

test.skip('should navigate to the auth page on click', async ({ page }) => {
  await page.click('.action__auth')
  expect(page.url().substring(page.url().lastIndexOf('/'))).toEqual('/auth')
})
