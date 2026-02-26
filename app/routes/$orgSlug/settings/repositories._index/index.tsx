import { useMemo } from 'react'
import { Link } from 'react-router'
import { Button } from '~/app/components/ui/button'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import ContentSection from '../+components/content-section'
import { createColumns } from './+components/repo-columns'
import { RepoTable } from './+components/repo-table'
import {
  PaginationSchema,
  QuerySchema,
  SortSchema,
} from './+hooks/use-data-table-state'
import type { Route } from './+types/index'
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

  return { organization, repositories, pagination }
}

export default function OrganizationRepositoryIndexPage({
  loaderData: { organization, repositories, pagination },
}: Route.ComponentProps) {
  const slug = organization.slug
  const columns = useMemo(() => createColumns(slug), [slug])

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
        />
      </>
    </ContentSection>
  )
}
