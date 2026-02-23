import { data } from 'react-router'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import { columns } from './+components/github-users-columns'
import { GithubUsersTable } from './+components/github-users-table'
import {
  PaginationSchema,
  QuerySchema,
  SortSchema,
} from './+hooks/use-data-table-state'
import type { Route } from './+types/route'
import {
  addGithubUser,
  deleteGithubUser,
  updateGithubUser,
} from './mutations.server'
import { listFilteredGithubUsers } from './queries.server'

export const handle = {
  breadcrumb: ({ organization }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'GitHub Users',
    to: `/${organization.slug}/settings/github-users`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const searchParams = new URL(request.url).searchParams

  const { search } = QuerySchema.parse({
    search: searchParams.get('search'),
  })

  const { sort_by: sortBy, sort_order: sortOrder } = SortSchema.parse({
    sort_by: searchParams.get('sort_by'),
    sort_order: searchParams.get('sort_order'),
  })

  const { page: currentPage, per_page: pageSize } = PaginationSchema.parse({
    page: searchParams.get('page'),
    per_page: searchParams.get('per_page'),
  })

  const { data: githubUsers, pagination } = await listFilteredGithubUsers({
    organizationId: organization.id,
    search,
    currentPage,
    pageSize,
    sortBy,
    sortOrder,
  })

  return { organization, githubUsers, pagination }
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'add') {
    const login = formData.get('login') as string
    const displayName = formData.get('displayName') as string
    await addGithubUser({
      login,
      displayName,
      organizationId: organization.id,
    })
    return data({ ok: true })
  }

  if (intent === 'update') {
    const login = formData.get('login') as string
    const displayName = formData.get('displayName') as string
    const name = (formData.get('name') as string) || null
    const email = (formData.get('email') as string) || null
    await updateGithubUser({
      login,
      organizationId: organization.id,
      displayName,
      name,
      email,
    })
    return data({ ok: true })
  }

  if (intent === 'delete') {
    const login = formData.get('login') as string
    await deleteGithubUser(login, organization.id)
    return data({ ok: true })
  }

  return data({ error: 'Invalid intent' }, { status: 400 })
}

export default function GithubUsersPage({
  loaderData: { githubUsers, pagination },
}: Route.ComponentProps) {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>GitHub Users</PageHeaderTitle>
          <PageHeaderDescription>
            Manage GitHub users linked to this organization.
          </PageHeaderDescription>
        </PageHeaderHeading>
      </PageHeader>
      <div className="-mx-4 flex-1 overflow-auto px-4 py-1">
        <GithubUsersTable
          data={githubUsers}
          columns={columns}
          pagination={pagination}
        />
      </div>
    </>
  )
}
