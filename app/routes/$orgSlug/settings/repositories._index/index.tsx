import { useMemo } from 'react'
import { Link, data } from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { Button } from '~/app/components/ui/button'
import { requireOrgAdmin } from '~/app/libs/auth.server'
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

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const searchParams = new URL(request.url).searchParams

  const { repo } = QuerySchema.parse({
    repo: searchParams.get('repo'),
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
    currentPage,
    pageSize,
    sortBy,
    sortOrder,
  })

  const teams = await listTeams(organization.id)

  return { organization, repositories, pagination, teams }
}

const updateTeamSchema = z.object({
  repositoryId: z.string().min(1),
  teamId: z.string().nullable(),
})

const bulkUpdateTeamSchema = z.object({
  repositoryIds: z.array(z.string().min(1)).min(1),
  teamId: z.string().nullable(),
})

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  return match(intent)
    .with('updateTeam', async () => {
      const parsed = updateTeamSchema.parse({
        repositoryId: formData.get('repositoryId'),
        teamId: formData.get('teamId') || null,
      })
      await updateRepositoryTeam(
        organization.id,
        parsed.repositoryId,
        parsed.teamId,
      )
      return data({ ok: true })
    })
    .with('bulkUpdateTeam', async () => {
      const parsed = bulkUpdateTeamSchema.parse({
        repositoryIds: formData.getAll('repositoryIds'),
        teamId: formData.get('teamId') || null,
      })
      await bulkUpdateRepositoryTeam(
        organization.id,
        parsed.repositoryIds,
        parsed.teamId,
      )
      return data({ ok: true })
    })
    .otherwise(() => data({ error: 'Invalid intent' }, { status: 400 }))
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
      {/** biome-ignore lint/complexity/noUselessFragments: false positive */}
      <>
        <div className="flex justify-end pb-2">
          <Button asChild>
            <Link to={`/${slug}/settings/repositories/add`}>
              Add Repository
            </Link>
          </Button>
        </div>
        <RepoTable
          data={repositories}
          columns={columns}
          pagination={pagination}
          teams={teams}
        />
      </>
    </ContentSection>
  )
}
