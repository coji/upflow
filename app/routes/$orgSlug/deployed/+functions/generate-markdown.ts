import type { PullRequest } from '../index'

export function generateMarkdown(pulls: PullRequest[]) {
  const header1 =
    '| Author | Repo | No | タイトル | デプロイまで | デプロイ時間 |\n'
  const header2 = '| ------ | -- | -- | -------- | ---------- | ---------- |\n'
  const body = pulls
    .map(
      (row) =>
        `| ${row.authorDisplayName ?? row.author} | ${row.repo} | ${row.number} | [${row.title}](${row.url}) | ${row.createAndDeployDiff?.toFixed(1) ?? '-'}日${!row.achievement ? ' 超過' : ''} | ${row.deployTime?.toFixed(1) ?? '-'}日 |`,
    )
    .join('\n')
  return `${header1}${header2}${body}`
}
