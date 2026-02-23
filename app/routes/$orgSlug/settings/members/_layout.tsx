import { data } from 'react-router'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import { columns } from './+components/members-columns'
import { MembersTable } from './+components/members-table'
import {
  FilterSchema,
  PaginationSchema,
  QuerySchema,
  SortSchema,
} from './+hooks/use-data-table-state'
import type { Route } from './+types/_layout'
import { changeMemberRole, removeMember } from './mutations.server'
import { listFilteredMembers } from './queries.server'

export const handle = {
  breadcrumb: ({ organization }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'Members',
    to: `/${organization.slug}/settings/members`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const searchParams = new URL(request.url).searchParams

  const { name } = QuerySchema.parse({
    name: searchParams.get('name'),
  })

  const filters = FilterSchema.parse({
    role: searchParams.getAll('role'),
  })

  const { sort_by: sortBy, sort_order: sortOrder } = SortSchema.parse({
    sort_by: searchParams.get('sort_by'),
    sort_order: searchParams.get('sort_order'),
  })

  const { page: currentPage, per_page: pageSize } = PaginationSchema.parse({
    page: searchParams.get('page'),
    per_page: searchParams.get('per_page'),
  })

  const { data: members, pagination } = await listFilteredMembers({
    organizationId: organization.id,
    name,
    filters,
    currentPage,
    pageSize,
    sortBy,
    sortOrder,
  })

  return { organization, members, pagination }
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  await requireOrgAdmin(request, params.orgSlug)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'changeRole') {
    const memberId = formData.get('memberId') as string
    const role = formData.get('role') as string
    await changeMemberRole(memberId, role)
    return data({ ok: true })
  }

  if (intent === 'removeMember') {
    const memberId = formData.get('memberId') as string
    await removeMember(memberId)
    return data({ ok: true })
  }

  return data({ error: 'Invalid intent' }, { status: 400 })
}

export default function OrganizationMembersPage({
  loaderData: { members, pagination },
}: Route.ComponentProps) {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Members</PageHeaderTitle>
          <PageHeaderDescription>
            Manage organization members and their roles.
          </PageHeaderDescription>
        </PageHeaderHeading>
      </PageHeader>
      <div className="-mx-4 flex-1 overflow-auto px-4 py-1">
        <MembersTable
          data={members}
          columns={columns}
          pagination={pagination}
        />
      </div>
    </>
  )
}
