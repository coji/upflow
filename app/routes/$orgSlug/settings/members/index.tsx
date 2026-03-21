import { parseWithZod } from '@conform-to/zod/v4'
import { useMemo } from 'react'
import { data, href } from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { useTimezone } from '~/app/hooks/use-timezone'
import { getErrorMessage } from '~/app/libs/error-message'
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

export const changeRoleSchema = z.object({
  intent: z.literal('changeRole'),
  memberId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'member']),
})

const confirmRemoveMemberSchema = z.object({
  intent: z.literal('confirm-removeMember'),
  memberId: z.string().min(1),
})

const removeMemberSchema = z.object({
  intent: z.literal('removeMember'),
  memberId: z.string().min(1),
})

const actionSchema = z.discriminatedUnion('intent', [
  changeRoleSchema,
  confirmRemoveMemberSchema,
  removeMemberSchema,
])

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization, membership } = context.get(orgContext)
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: actionSchema })
  if (submission.status !== 'success') {
    return data({ lastResult: submission.reply() }, { status: 400 })
  }

  return match(submission.value)
    .with({ intent: 'changeRole' }, async ({ memberId, role }) => {
      try {
        await changeMemberRole(memberId, organization.id, role, membership.id)
      } catch (e) {
        return data(
          {
            lastResult: submission.reply({ formErrors: [getErrorMessage(e)] }),
          },
          { status: 400 },
        )
      }
      return data({ ok: true })
    })
    .with({ intent: 'confirm-removeMember' }, () => {
      return data({ shouldConfirm: true })
    })
    .with({ intent: 'removeMember' }, async ({ memberId }) => {
      try {
        await removeMember(memberId, organization.id, membership.id)
      } catch (e) {
        return data(
          {
            lastResult: submission.reply({ formErrors: [getErrorMessage(e)] }),
            shouldConfirm: true,
          },
          { status: 400 },
        )
      }
      return data({ ok: true })
    })
    .exhaustive()
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
