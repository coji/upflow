// features/teams.md の journey。Settings → Teams でチームを足し、DB に入り、
// 削除で行も DB からも消えることを確かめる。
export default async ({ page, expect, capture, sql, record }) => {
  const teamRows = () =>
    sql(
      'tenant',
      "select name, personal_limit from teams where name = 'Verify Platform'",
    )
  expect(teamRows()).toEqual([])

  await page.goto('/techtalk/settings')
  await page.getByRole('link', { name: 'Teams' }).click()
  await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Enter team name' })
    .fill('Verify Platform')
  await page.getByRole('button', { name: 'Add' }).click()
  const row = page.getByRole('row', { name: /Verify Platform/ })
  await expect(row).toBeVisible()
  await capture('team-added')
  await expect.poll(() => teamRows().length).toBe(1)
  record('db-after-add', teamRows())
  expect(teamRows()[0].personal_limit).toBe(2)

  // リロードしても残る
  await page.reload()
  await expect(page.getByRole('row', { name: /Verify Platform/ })).toBeVisible()

  await page
    .getByRole('row', { name: /Verify Platform/ })
    .getByRole('button')
    .last()
    .click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete Team' })
  await expect(dialog).toBeVisible()
  await capture('delete-confirm')
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(
    page.getByRole('cell', { name: 'No teams registered yet.' }),
  ).toBeVisible()
  await capture('team-deleted')
  record('db-after-delete', teamRows())
  expect(teamRows()).toEqual([])
}
