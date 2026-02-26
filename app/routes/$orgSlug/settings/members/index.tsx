import { data } from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import ContentSection from '../+components/content-section'
import { columns } from './+components/members-columns'
import { MembersTable } from './+components/members-table'
import {
  FilterSchema,
  PaginationSchema,
  QuerySchema,
  SortSchema,
} from './+hooks/use-data-table-state'
import type { Route } from './+types/index'
import { changeMemberRole, removeMember } from './mutations.server'
import { listFilteredMembers } from './queries.server'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Members',
    to: `/${params.orgSlug}/settings/members`,
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

  return { members, pagination }
}

const changeRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'member']),
})

const removeMemberSchema = z.object({
  memberId: z.string().min(1),
})

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  return match(intent)
    .with('changeRole', async () => {
      const { memberId, role } = changeRoleSchema.parse({
        memberId: formData.get('memberId'),
        role: formData.get('role'),
      })
      await changeMemberRole(memberId, organization.id, role)
      return data({ ok: true })
    })
    .with('removeMember', async () => {
      const { memberId } = removeMemberSchema.parse({
        memberId: formData.get('memberId'),
      })
      try {
        await removeMember(memberId, organization.id)
      } catch (e) {
        return data({ error: String(e) }, { status: 400 })
      }
      return data({ ok: true })
    })
    .otherwise(() => data({ error: 'Invalid intent' }, { status: 400 }))
}

export default function OrganizationMembersPage({
  loaderData: { members, pagination },
}: Route.ComponentProps) {
  return (
    <ContentSection
      title="Members"
      desc="Manage organization members and their roles."
      fullWidth
    >
      <MembersTable data={members} columns={columns} pagination={pagination} />
    </ContentSection>
  )
}
