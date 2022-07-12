import dayjs from 'dayjs'
import { createLoader } from '../loader'

export async function commitCommand(iid: number | undefined) {
  const loader = createLoader()
  const allMergeRequests = await loader.mergerequests()

  console.log(['iid', 'committed_at', 'created_at', 'merged_at', 'author', 'title'].join('\t'))
  for (const mr of allMergeRequests) {
    if ((iid && mr.iid !== iid) || mr.state === 'closed' || mr.target_branch === 'production') {
      continue
    }
    const commits = await loader.commits(mr.iid)
    commits
      .sort((a, b) => (b.created_at < a.created_at ? 1 : -1))
      .map((commit) =>
        [
          mr.iid,
          dayjs(commit.created_at).format('YYYY-MM-DD HH:mm'),
          dayjs(mr.created_at).format('YYYY-MM-DD HH:mm'),
          dayjs(mr.merged_at).format('YYYY-MM-DD HH:mm'),
          commit.author_name,
          commit.title.substring(0, 60).replaceAll(/\n|"|\t/g, '') // コミットタイトルに改行・タブ・ダブルクオートがあるときはややこしいので消し込む。
        ].join('\t')
      )
      .forEach((commit) => console.log(commit))
    console.log('')
  }
}
