import type { PullRequest } from '../route'

export function generateMarkdown(pulls: PullRequest[]) {
  const header1 = '| Author | Repo | No | タイトル | マージまで |\n'
  const header2 = '| ------ | -- | -- | -------- | ---------- |\n'
  const body = pulls
    .map(
      (row) =>
        `|${row.authorDisplayName ?? row.author}|${row.repo}|${row.number}|[${row.title}](${row.url})|${row.createAndMergeDiff?.toFixed(1)}日 ${!row.achievement ? '超過' : ''}|`,
    )
    .join('\n')
  return `${header1}${header2}${body}`
}
