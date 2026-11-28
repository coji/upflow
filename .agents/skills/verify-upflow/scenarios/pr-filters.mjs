// features/pr-filters.md の journey。PR Filters に title パターンを足すと、
// Review Stacks と Throughput から該当 PR が消え、無効化・削除で戻ることを確かめる。
const SSO_PR = 'techtalk/backend#102 (In review)'

export default async ({ page, expect, capture, sql, record }) => {
  const filtersFor = () =>
    sql(
      'tenant',
      "select target, pattern, is_enabled from pr_title_filters where pattern = 'SSO login'",
    )

  // 前提: seed にフィルタは無く、#102 は Review Stacks に出ている
  await page.goto('/techtalk/workload')
  await expect(
    page.getByRole('heading', { name: 'Review Stacks', level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: SSO_PR }).first()).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: 'No PRs hidden. Choose which PRs to hide',
    }),
  ).toBeVisible()
  await capture('before-review-stacks')

  // 追加: Settings → PR Filters で Title に "SSO login" を足す
  await page.goto('/techtalk/settings')
  await page.getByRole('link', { name: 'PR Filters' }).click()
  await expect(page.getByRole('heading', { name: 'PR Filters' })).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Match against' })
    .selectOption('title')
  await page
    .getByRole('textbox', { name: 'e.g. [DO NOT MERGE]' })
    .fill('SSO login')
  await page.getByRole('button', { name: 'Add' }).click()
  const row = page.getByRole('row', { name: /SSO login/ })
  await expect(row).toBeVisible()
  await expect(row.getByRole('switch')).toBeChecked()
  await capture('filter-added')
  const added = filtersFor()
  record('db-after-add', added)
  expect(added).toEqual([
    { target: 'title', pattern: 'SSO login', is_enabled: 1 },
  ])

  // 効果: Review Stacks から #102 が消え、隠した件数が出る
  await page.goto('/techtalk/workload')
  await expect(page.getByRole('button', { name: SSO_PR })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '1 PR hidden. Choose which PRs to hide' }),
  ).toBeVisible()
  await capture('review-stacks-filtered')

  // 効果: Throughput → Ongoing からも消える
  await page.goto('/techtalk/throughput/ongoing')
  await expect(
    page.getByRole('heading', { name: 'Ongoing', level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Implement SSO login flow' }),
  ).toHaveCount(0)
  await capture('ongoing-filtered')

  // 無効化: Enabled の switch を切ると #102 が戻る
  await page.goto('/techtalk/settings/pr-filters')
  await page
    .getByRole('row', { name: /SSO login/ })
    .getByRole('switch')
    .click()
  await expect(
    page.getByRole('row', { name: /SSO login/ }).getByRole('switch'),
  ).not.toBeChecked()
  await expect.poll(() => filtersFor()[0]?.is_enabled).toBe(0)
  await page.goto('/techtalk/workload')
  await expect(page.getByRole('button', { name: SSO_PR }).first()).toBeVisible()
  await capture('review-stacks-after-disable')

  // 削除: 行のゴミ箱 → 確認ダイアログの Delete で行も DB からも消える
  await page.goto('/techtalk/settings/pr-filters')
  await page
    .getByRole('row', { name: /SSO login/ })
    .getByRole('button')
    .click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete filter' })
  await expect(dialog).toBeVisible()
  await capture('delete-confirm')
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(
    page.getByRole('cell', { name: 'No filters yet.' }),
  ).toBeVisible()
  await capture('filter-deleted')
  record('db-after-delete', filtersFor())
  expect(filtersFor()).toEqual([])
}
