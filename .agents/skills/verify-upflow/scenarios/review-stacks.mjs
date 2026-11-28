// features/review-stacks.md の journey。Review Stacks の 2 列、PR の popover、
// メンバーごとの drill-down を、seed のデータで確かめる。
export default async ({ page, expect, capture }) => {
  // org のトップは Review Stacks に redirect する
  await page.goto('/techtalk')
  await expect(page).toHaveURL(/\/techtalk\/workload$/)
  await expect(
    page.getByRole('heading', { name: 'Review Stacks', level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Authored PRs (open)' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Review Queue (pending)' }),
  ).toBeVisible()
  // seed の open PR は #101-#108。Alice は #101 と #106 を書いている
  await expect(
    page
      .getByRole('button', { name: 'techtalk/frontend#101 (In review)' })
      .first(),
  ).toBeVisible()
  await expect(
    page
      .getByRole('button', { name: 'techtalk/frontend#107 (In review, Draft)' })
      .first(),
  ).toBeVisible()
  await capture('review-stacks')

  // PR の丸をクリックすると popover にタイトルが出る
  await page
    .getByRole('button', { name: 'techtalk/backend#102 (In review)' })
    .first()
    .click()
  const popover = page.getByRole('dialog')
  await expect(popover).toContainText('Implement SSO login flow')
  await capture('pr-popover')
  await page.keyboard.press('Escape')
  await expect(popover).toHaveCount(0)

  // メンバー名から drill-down に入り、← Review Stacks で戻る
  await page.getByRole('link', { name: 'alice Alice Chen' }).first().click()
  await expect(page).toHaveURL(/\/techtalk\/workload\/alice$/)
  await expect(page.getByText('Alice Chen').first()).toBeVisible()
  await capture('drill-down-alice')
  await page.getByRole('link', { name: '← Review Stacks' }).click()
  await expect(page).toHaveURL(/\/techtalk\/workload/)
  await expect(
    page.getByRole('heading', { name: 'Review Stacks', level: 1 }),
  ).toBeVisible()
}
