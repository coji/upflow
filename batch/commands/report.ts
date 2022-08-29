import dayjs from 'dayjs'
import invariant from 'tiny-invariant'
import { allConfigs, loadConfig } from '../config'
import { buildMergeRequests } from '../provider/gitlab/mergerequest'
import { createStore } from '../provider/gitlab/store'

const timeFormat = (date: string | null) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : null)

interface reportCommandProps {
  companyId?: string
}

export async function reportCommand({ companyId }: reportCommandProps) {
  if (!companyId) {
    console.log('config should specified')
    console.log((await allConfigs()).map((c) => `${c.companyName}\t${c.companyId}`).join('\n'))
    return
  }
  const config = await loadConfig(companyId)
  invariant(config, `config not found: ${companyId}`)

  // ヘッダ
  console.log(
    [
      'id',
      'target_branch',
      'state',
      'コミット数',
      'コメント数',
      '初回コミット日時',
      'MR作成日時',
      '初回レビュー日時',
      'マージ日時',
      'リリース日時',
      'リリースにコミット済',
      'MR作成者',
      'MRタイトル'
    ].join('\t')
  )

  for (const repository of config.repositories) {
    const store = createStore({
      companyId: config.companyId,
      repositoryId: repository.id
    })

    const results = await buildMergeRequests(
      {
        companyId: config.companyId,
        repositoryId: repository.id
      },
      await store.loader.mergerequests()
    )

    for (const mr of results) {
      console.log(
        [
          mr.id,
          mr.target_branch,
          mr.state,
          mr.num_of_comments,
          mr.num_of_comments,
          timeFormat(mr.first_commited_at),
          timeFormat(mr.mergerequest_created_at),
          timeFormat(mr.first_reviewd_at),
          timeFormat(mr.merged_at),
          timeFormat(mr.released_at),
          mr.is_release_committed,
          mr.author,
          mr.title
        ].join('\t')
      )
    }
  }
}
