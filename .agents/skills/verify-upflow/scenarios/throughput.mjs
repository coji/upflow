// features/throughput.md の journey。Ongoing / Merged / Deployed を sidebar から開き、
// Merged の週送りで表が切り替わることを確かめる。
export default async ({ page, expect, capture }) => {
  await page.goto('/techtalk/workload')
  await page.getByRole('link', { name: 'Ongoing' }).click()
  await expect(
    page.getByRole('heading', { name: 'Ongoing', level: 1 }),
  ).toBeVisible()
  // seed の open PR は 8 本 (#101-#108)
  await expect(page.getByRole('row', { name: /More actions$/ })).toHaveCount(8)
  await expect(
    page.getByRole('link', { name: 'Implement SSO login flow' }),
  ).toHaveAttribute('href', 'https://github.com/techtalk/backend/pull/102')
  await capture('ongoing')

  await page.getByRole('link', { name: 'Merged' }).click()
  await expect(
    page.getByRole('heading', { name: 'Merged', level: 1 }),
  ).toBeVisible()
  const week = page.getByRole('button', {
    name: /^\d{2}\/\d{2} – \d{2}\/\d{2}$/,
  })
  const thisWeek = await week.textContent()
  await capture('merged-this-week')
  await page.getByRole('button', { name: 'Previous week' }).click()
  await expect(week).not.toHaveText(thisWeek ?? '')
  await expect(page).toHaveURL(/[?&]from=/)
  await capture('merged-previous-week')
  await page.getByRole('button', { name: 'Next week' }).click()
  await expect(week).toHaveText(thisWeek ?? '')

  await page.getByRole('link', { name: 'Deployed' }).click()
  await expect(
    page.getByRole('heading', { name: 'Deployed', level: 1 }),
  ).toBeVisible()
  await capture('deployed')
}
