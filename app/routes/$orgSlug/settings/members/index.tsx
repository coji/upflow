import { useMemo } from 'react'
import { data, href } from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { useTimezone } from '~/app/hooks/use-timezone'
import { orgContext } from '~/app/middleware/context'
import ContentSection from '../+components/content-section'
import { createColumns } from './+components/members-columns'
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
    to: href('/:orgSlug/settings/members', { orgSlug: params.orgSlug }),
  }),
}

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)
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

  return { members, pagination, currentMembershipId: membership.id }
}

const changeRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'member']),
})

const removeMemberSchema = z.object({
  memberId: z.string().min(1),
})

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization, membership } = context.get(orgContext)
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  return match(intent)
    .with('changeRole', async () => {
      const parsed = changeRoleSchema.safeParse({
        memberId: formData.get('memberId'),
        role: formData.get('role'),
      })
      if (!parsed.success) {
        return data({ error: 'Invalid input' }, { status: 400 })
      }
      try {
        await changeMemberRole(
          parsed.data.memberId,
          organization.id,
          parsed.data.role,
          membership.id,
        )
      } catch (e) {
        return data({ error: String(e) }, { status: 400 })
      }
      return data({ ok: true })
    })
    .with('removeMember', async () => {
      const parsed = removeMemberSchema.safeParse({
        memberId: formData.get('memberId'),
      })
      if (!parsed.success) {
        return data({ error: 'Invalid input' }, { status: 400 })
      }
      try {
        await removeMember(parsed.data.memberId, organization.id, membership.id)
      } catch (e) {
        return data({ error: String(e) }, { status: 400 })
      }
      return data({ ok: true })
    })
    .otherwise(() => data({ error: 'Invalid intent' }, { status: 400 }))
}

export default function OrganizationMembersPage({
  loaderData: { members, pagination, currentMembershipId },
}: Route.ComponentProps) {
  const timezone = useTimezone()
  const columns = useMemo(() => createColumns(timezone), [timezone])

  return (
    <ContentSection
      title="Members"
      desc="Manage organization members and their roles."
      fullWidth
    >
      <MembersTable
        data={members}
        columns={columns}
        pagination={pagination}
        currentMembershipId={currentMembershipId}
      />
    </ContentSection>
  )
}
