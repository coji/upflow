import { expect, test } from '@playwright/test'

test.describe('dashboard', () => {
  test('seed org dashboard shows Review Stacks', async ({ page }) => {
    await page.goto('/techtalk')
    await expect(
      page.getByRole('heading', { name: 'Review Stacks' }),
    ).toBeVisible()
  })
})
