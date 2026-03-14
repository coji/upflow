import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { jsonResponse, repoSchema, teamSchema } from './shared'

export const registerOngoingWorkTools = (
  server: McpServer,
  organizationId: OrganizationId,
) => {
  server.tool(
    'get_ongoing_work',
    `現在の仕掛品（WIP）を一覧する。オープン中のPRとその滞留時間を返す。
ToC的にWIPの削減はリードタイム改善に直結する（Little's Law）。
WIPが多すぎる場合、新しいPRを作るよりも既存のPRをマージすることに注力すべき。
レビュー待ちで止まっているPRを特定し、フローを解消するために使う。`,
    {
      team: teamSchema,
      repo: repoSchema,
    },
    async ({ team, repo }) => {
      const tenantDb = getTenantDb(organizationId)
      const now = new Date().toISOString()

      let query = tenantDb
        .selectFrom('pullRequests')
        .innerJoin(
          'repositories',
          'pullRequests.repositoryId',
          'repositories.id',
        )
        .leftJoin('companyGithubUsers', (join) =>
          join.onRef(
            (eb) => eb.fn('lower', ['pullRequests.author']),
            '=',
            (eb) => eb.fn('lower', ['companyGithubUsers.login']),
          ),
        )
        .select([
          'pullRequests.number',
          'pullRequests.title',
          'pullRequests.author',
          'pullRequests.url',
          'pullRequests.pullRequestCreatedAt',
          'pullRequests.firstReviewedAt',
          'pullRequests.additions',
          'pullRequests.deletions',
          'pullRequests.complexity',
          'repositories.repo',
          'companyGithubUsers.displayName',
        ])
        .where('pullRequests.mergedAt', 'is', null)
        .where('pullRequests.state', '=', 'open')
        .where((eb) =>
          eb.or([
            eb('companyGithubUsers.type', 'is', null),
            eb('companyGithubUsers.type', '!=', 'Bot'),
          ]),
        )
        .orderBy('pullRequests.pullRequestCreatedAt', 'asc')

      if (repo) query = query.where('repositories.repo', '=', repo)
      if (team)
        query = query
          .innerJoin('teams', 'repositories.teamId', 'teams.id')
          .where('teams.name', '=', team)

      const prs = await query.execute()

      // 各PRのステージ判定と滞留時間
      const items = prs.map((pr) => {
        const createdAt = new Date(pr.pullRequestCreatedAt).getTime()
        const nowMs = new Date(now).getTime()
        const elapsedDays = Number(((nowMs - createdAt) / 86400000).toFixed(1))

        const stage = pr.firstReviewedAt ? 'in_review' : 'awaiting_review'

        return {
          repo: pr.repo,
          number: pr.number,
          title: pr.title,
          author: pr.displayName ?? pr.author,
          url: pr.url,
          stage,
          elapsedDays,
          size: (pr.additions ?? 0) + (pr.deletions ?? 0),
          complexity: pr.complexity ?? 'unclassified',
        }
      })

      return jsonResponse({
        wipCount: items.length,
        items,
        byStage: {
          awaitingReview: items.filter((i) => i.stage === 'awaiting_review')
            .length,
          inReview: items.filter((i) => i.stage === 'in_review').length,
        },
      })
    },
  )

  server.tool(
    'get_pending_reviews',
    `レビュー待ちのPRと担当レビュワーを一覧する。
レビューキューの滞留はフローを止める最大の要因の一つ。
誰がどのPRのレビューを待たされているか、どのレビュワーが詰まっているかを可視化する。`,
    {
      team: teamSchema,
    },
    async ({ team }) => {
      const tenantDb = getTenantDb(organizationId)

      let query = tenantDb
        .selectFrom('pullRequestReviewers')
        .innerJoin('pullRequests', (join) =>
          join
            .onRef(
              'pullRequestReviewers.pullRequestNumber',
              '=',
              'pullRequests.number',
            )
            .onRef(
              'pullRequestReviewers.repositoryId',
              '=',
              'pullRequests.repositoryId',
            ),
        )
        .innerJoin(
          'repositories',
          'pullRequests.repositoryId',
          'repositories.id',
        )
        .select([
          'pullRequests.number',
          'pullRequests.title',
          'pullRequests.author',
          'pullRequests.url',
          'pullRequests.pullRequestCreatedAt',
          'pullRequestReviewers.reviewer',
          'pullRequestReviewers.requestedAt',
          'repositories.repo',
        ])
        .where('pullRequests.mergedAt', 'is', null)
        .where('pullRequests.state', '=', 'open')
        .where('pullRequestReviewers.requestedAt', 'is not', null)

      if (team)
        query = query
          .innerJoin('teams', 'repositories.teamId', 'teams.id')
          .where('teams.name', '=', team)

      const rows = await query.execute()

      const now = Date.now()
      const items = rows.map((r) => ({
        repo: r.repo,
        number: r.number,
        title: r.title,
        author: r.author,
        url: r.url,
        reviewer: r.reviewer,
        waitingDays: r.requestedAt
          ? Number(
              ((now - new Date(r.requestedAt).getTime()) / 86400000).toFixed(1),
            )
          : null,
      }))

      // レビュワー別集計
      const byReviewer: Record<string, number> = {}
      for (const item of items) {
        byReviewer[item.reviewer] = (byReviewer[item.reviewer] ?? 0) + 1
      }

      return jsonResponse({
        pendingCount: items.length,
        items: items.sort(
          (a, b) => (b.waitingDays ?? 0) - (a.waitingDays ?? 0),
        ),
        byReviewer: Object.entries(byReviewer)
          .map(([reviewer, count]) => ({ reviewer, count }))
          .sort((a, b) => b.count - a.count),
      })
    },
  )
}
