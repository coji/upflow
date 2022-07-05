import dayjs from 'dayjs'
import { createLoader } from '../loader'

export async function commitCommand(iid: number) {
  const loader = createLoader()
  const commits = await loader.commits(iid)
  commits
    .sort((a, b) => (b.created_at < a.created_at ? 1 : -1))
    .map((commit) => [dayjs(commit.created_at).format('YYYY-MM-DD HH:mm'), commit.author_name, commit.title.substring(0, 60).replaceAll('\n', '')].join('\t'))
    .forEach((commit) => console.log(commit))
}
