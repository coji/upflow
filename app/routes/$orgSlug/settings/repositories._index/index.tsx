import { parseWithZod } from '@conform-to/zod/v4'
import { useMemo } from 'react'
import { data } from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { orgContext } from '~/app/middleware/context'
import ContentSection from '../+components/content-section'
import { listTeams } from '../teams._index/queries.server'
import { createColumns } from './+components/repo-columns'
import { RepoTable } from './+components/repo-table'
import {
  PaginationSchema,
  QuerySchema,
  SortSchema,
} from './+hooks/use-data-table-state'
import type { Route } from './+types/index'
import {
  bulkUpdateRepositoryTeam,
  updateRepositoryTeam,
} from './mutations.server'
import { listFilteredRepositories } from './queries.server'

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const searchParams = new URL(request.url).searchParams

  const { repo, team } = QuerySchema.parse({
    repo: searchParams.get('repo'),
    team: searchParams.get('team'),
  })

  const { sort_by: sortBy, sort_order: sortOrder } = SortSchema.parse({
    sort_by: searchParams.get('sort_by'),
    sort_order: searchParams.get('sort_order'),
  })

  const { page: currentPage, per_page: pageSize } = PaginationSchema.parse({
    page: searchParams.get('page'),
    per_page: searchParams.get('per_page'),
  })

  const { data: repositories, pagination } = await listFilteredRepositories({
    organizationId: organization.id,
    repo,
    teamId: team || undefined,
    currentPage,
    pageSize,
    sortBy,
    sortOrder,
  })

  const teams = await listTeams(organization.id)

  return { organization, repositories, pagination, teams }
}

const nullableTeamId = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.string().min(1).nullable(),
)

const updateTeamSchema = z.object({
  intent: z.literal('updateTeam'),
  repositoryId: z.string().min(1),
  teamId: nullableTeamId,
})

const bulkUpdateTeamSchema = z.object({
  intent: z.literal('bulkUpdateTeam'),
  repositoryIds: z.array(z.string().min(1)).min(1),
  teamId: nullableTeamId,
})

const actionSchema = z.discriminatedUnion('intent', [
  updateTeamSchema,
  bulkUpdateTeamSchema,
])

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization } = context.get(orgContext)
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: actionSchema })
  if (submission.status !== 'success') {
    return data({ lastResult: submission.reply() }, { status: 400 })
  }

  return match(submission.value)
    .with({ intent: 'updateTeam' }, async ({ repositoryId, teamId }) => {
      await updateRepositoryTeam(organization.id, repositoryId, teamId)
      return data({ ok: true })
    })
    .with({ intent: 'bulkUpdateTeam' }, async ({ repositoryIds, teamId }) => {
      await bulkUpdateRepositoryTeam(organization.id, repositoryIds, teamId)
      return data({ ok: true })
    })
    .exhaustive()
}

export default function OrganizationRepositoryIndexPage({
  loaderData: { organization, repositories, pagination, teams },
}: Route.ComponentProps) {
  const slug = organization.slug
  const columns = useMemo(() => createColumns(slug, teams), [slug, teams])

  return (
    <ContentSection
      title="Repositories"
      desc="Manage repositories tracked by this organization."
      fullWidth
    >
      <RepoTable
        data={repositories}
        columns={columns}
        pagination={pagination}
        teams={teams}
        orgSlug={slug}
      />
    </ContentSection>
  )
}
