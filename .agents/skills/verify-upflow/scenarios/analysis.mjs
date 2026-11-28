// features/analysis.md の journey。Analysis の 4 画面が seed データで描画され、
// Cycle Time の期間切り替えが URL と表示に効くことを確かめる。
export default async ({ page, expect, capture }) => {
  await page.goto('/techtalk/workload')

  await page.getByRole('link', { name: 'Cycle Time' }).click()
  await expect(page).toHaveURL(/\/analysis\/cycle-time/)
  await expect(
    page.getByRole('heading', { name: 'Cycle Time', level: 1 }),
  ).toBeVisible()
  await expect(page.getByText('Weekly Cycle Time Trend')).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'Cycle time stage composition' }),
  ).toBeVisible()
  await expect(
    page.getByRole('row', { name: /^alice Alice Chen/ }),
  ).toBeVisible()
  await capture('cycle-time-3-months')
  await page.getByRole('radio', { name: 'Average' }).click()
  await expect(page.getByRole('radio', { name: 'Average' })).toBeChecked()
  await capture('cycle-time-average')

  await page.getByRole('link', { name: 'Review Bottleneck' }).click()
  await expect(page).toHaveURL(/\/analysis\/reviews/)
  await expect(
    page.getByRole('heading', { name: 'Review Bottleneck', level: 1 }),
  ).toBeVisible()
  await expect(page.getByText('Review Queue Trend')).toBeVisible()
  await expect(
    page.getByText('PR Size Distribution & Review Time'),
  ).toBeVisible()
  await capture('review-bottleneck')

  await page.getByRole('link', { name: 'Inventory' }).click()
  await expect(page).toHaveURL(/\/analysis\/inventory/)
  await expect(
    page.getByRole('heading', { name: 'Open PR Inventory', level: 1 }),
  ).toBeVisible()
  await capture('inventory')

  await page.getByRole('link', { name: 'Feedbacks' }).click()
  await expect(page).toHaveURL(/\/analysis\/feedbacks/)
  await expect(
    page.getByRole('heading', { name: 'Feedbacks', level: 1 }),
  ).toBeVisible()
  await capture('feedbacks')
}
