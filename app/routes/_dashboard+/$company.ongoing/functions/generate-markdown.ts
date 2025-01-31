import type { PullRequest } from '../route'

export function generateMarkdown(pulls: PullRequest[]) {
  const header1 = '| Author | No | タイトル | 期間 |\n'
  const header2 = '| ------ | -- | -------- | ---------- |\n'
  const body = pulls
    .map(
      (row) =>
        `|${row.author}|${row.number}|[${row.title}](${row.url})|${row.createAndNowDiff?.toFixed(1)}日|`,
    )
    .join('\n')
  return `${header1}${header2}${body}`
}
