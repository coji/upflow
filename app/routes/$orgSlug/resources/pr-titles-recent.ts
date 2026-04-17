import { data } from 'react-router'
import { isOrgAdmin } from '~/app/libs/member-role'
import { orgContext } from '~/app/middleware/context'
import { orgAdminMiddleware } from '~/app/middleware/org-admin'
import { listRecentPullRequestTitles } from '~/app/services/pr-title-filter-queries.server'
import type { Route } from './+types/pr-titles-recent'

// Sheet プレビュー用の直近 PR タイトル一覧を返す resource route。
// admin のみアクセス可能 ($orgSlug/_layout.tsx は member ガードのみなので、ここで明示保護)。
// lazy fetch 前提で、通常閲覧時の loader payload には含めない。
export const middleware = [orgAdminMiddleware]

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)
  if (!isOrgAdmin(membership.role)) {
    // middleware と二重防御
    throw data({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const daysParam = Number(url.searchParams.get('days') ?? '90')
  const days = Number.isFinite(daysParam)
    ? Math.max(1, Math.min(180, Math.floor(daysParam)))
    : 90

  const titles = await listRecentPullRequestTitles(organization.id, days)

  return data({ titles, days }, { headers: { 'Cache-Control': 'no-store' } })
}
