import { parseWithZod } from '@conform-to/zod/v4'
import { useMemo } from 'react'
import { data, href } from 'react-router'
import { dataWithError, dataWithSuccess } from 'remix-toast'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { useTimezone } from '~/app/hooks/use-timezone'
import { getErrorMessage } from '~/app/libs/error-message'
import { orgContext } from '~/app/middleware/context'
import { getTenantDb } from '~/app/services/tenant-db.server'
import ContentSection from '../+components/content-section'
import { createColumns } from './+components/github-users-columns'
import { GithubUsersTable } from './+components/github-users-table'
import { searchGithubUsers } from './+functions/search-github-users.server'
import {
  PaginationSchema,
  QuerySchema,
  SortSchema,
} from './+hooks/use-data-table-state'
import type { Route } from './+types/index'
import {
  addGithubUser,
  deleteGithubUser,
  toggleGithubUserActive,
  updateGithubUser,
  updateGithubUserType,
} from './mutations.server'
import { listFilteredGithubUsers } from './queries.server'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'GitHub Users',
    to: href('/:orgSlug/settings/github-users', { orgSlug: params.orgSlug }),
  }),
}

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization, user } = context.get(orgContext)
  const searchParams = new URL(request.url).searchParams

  // GitHub user search for combobox candidates
  const q = searchParams.get('q')
  if (q !== null) {
    const candidates = q.trim()
      ? await searchGithubUsers(organization.id, q.trim())
      : []
    return Response.json({ candidates })
  }

  const { search, loginStatus } = QuerySchema.parse({
    search: searchParams.get('search'),
    loginStatus: searchParams.get('loginStatus'),
  })

  const { sort_by: sortBy, sort_order: sortOrder } = SortSchema.parse({
    sort_by: searchParams.get('sort_by'),
    sort_order: searchParams.get('sort_order'),
  })

  const { page: currentPage, per_page: pageSize } = PaginationSchema.parse({
    page: searchParams.get('page'),
    per_page: searchParams.get('per_page'),
  })

  const isActive: 0 | 1 | undefined =
    loginStatus === 'allowed' ? 1 : loginStatus === 'denied' ? 0 : undefined

  const { data: githubUsers, pagination } = await listFilteredGithubUsers({
    organizationId: organization.id,
    search,
    isActive,
    currentPage,
    pageSize,
    sortBy,
    sortOrder,
  })

  const tenantDb = getTenantDb(organization.id)
  const currentGithubUser = await tenantDb
    .selectFrom('companyGithubUsers')
    .select('login')
    .where('userId', '=', user.id)
    .executeTakeFirst()

  return {
    githubUsers,
    pagination,
    currentGithubLogin: currentGithubUser?.login ?? null,
  }
}

const addGithubUserSchema = z.object({
  intent: z.literal('add'),
  login: z.string().min(1),
  displayName: z.string().min(1),
})

const updateGithubUserSchema = z.object({
  intent: z.literal('update'),
  login: z.string().min(1),
  displayName: z.string().min(1),
})

const deleteFields = { login: z.string().min(1) }

const confirmDeleteSchema = z.object({
  intent: z.literal('confirm-delete'),
  ...deleteFields,
})

const deleteGithubUserSchema = z.object({
  intent: z.literal('delete'),
  ...deleteFields,
})

const typeFields = {
  login: z.string().min(1),
  type: z.preprocess(
    (v) => (v === '' ? null : v),
    z.enum(['User', 'Bot']).nullable(),
  ),
}

const confirmUpdateTypeSchema = z.object({
  intent: z.literal('confirm-update-type'),
  ...typeFields,
})

const updateTypeSchema = z.object({
  intent: z.literal('update-type'),
  ...typeFields,
})

const toggleActiveFields = {
  login: z.string().min(1),
  isActive: z.coerce
    .number()
    .int()
    .min(0)
    .max(1)
    .pipe(z.union([z.literal(0), z.literal(1)])),
}

const confirmToggleActiveSchema = z.object({
  intent: z.literal('confirm-toggle-active'),
  ...toggleActiveFields,
})

const toggleActiveSchema = z.object({
  intent: z.literal('toggle-active'),
  ...toggleActiveFields,
})

const actionSchema = z.discriminatedUnion('intent', [
  addGithubUserSchema,
  updateGithubUserSchema,
  confirmDeleteSchema,
  deleteGithubUserSchema,
  confirmUpdateTypeSchema,
  updateTypeSchema,
  confirmToggleActiveSchema,
  toggleActiveSchema,
])

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization, user } = context.get(orgContext)
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: actionSchema })
  if (submission.status !== 'success') {
    return data({ ok: false, lastResult: submission.reply() }, { status: 400 })
  }

  return match(submission.value)
    .with({ intent: 'add' }, async ({ login, displayName }) => {
      try {
        await addGithubUser({
          login,
          displayName,
          organizationId: organization.id,
        })
      } catch (e) {
        const message = getErrorMessage(e)
        return dataWithError(
          {
            ok: false,
            lastResult: submission.reply({ formErrors: [message] }),
          },
          { message },
        )
      }
      return dataWithSuccess(
        { ok: true, lastResult: null },
        { message: `${login} を追加しました` },
      )
    })
    .with({ intent: 'update' }, async ({ login, displayName }) => {
      try {
        await updateGithubUser({
          login,
          displayName,
          organizationId: organization.id,
        })
      } catch (e) {
        const message = getErrorMessage(e)
        return dataWithError(
          {
            ok: false,
            lastResult: submission.reply({ formErrors: [message] }),
          },
          { message },
        )
      }
      return dataWithSuccess(
        { ok: true, lastResult: null },
        { message: `${login} を更新しました` },
      )
    })
    .with({ intent: 'confirm-delete' }, () => {
      return data({ ok: false, lastResult: null, shouldConfirm: true })
    })
    .with({ intent: 'delete' }, async ({ login }) => {
      try {
        await deleteGithubUser(login, organization.id, user.id)
      } catch (e) {
        return data(
          {
            ok: false,
            lastResult: submission.reply({ formErrors: [getErrorMessage(e)] }),
            shouldConfirm: true,
          },
          { status: 400 },
        )
      }
      return dataWithSuccess(
        { ok: true, lastResult: null },
        { message: `${login} を削除しました` },
      )
    })
    .with({ intent: 'confirm-update-type' }, () => {
      return data({ ok: false, lastResult: null, shouldConfirm: true })
    })
    .with({ intent: 'update-type' }, async ({ login, type }) => {
      try {
        await updateGithubUserType({
          login,
          type,
          organizationId: organization.id,
        })
      } catch (e) {
        return data(
          {
            ok: false,
            lastResult: submission.reply({ formErrors: [getErrorMessage(e)] }),
            shouldConfirm: true,
          },
          { status: 400 },
        )
      }
      const typeLabel =
        type === 'Bot' ? 'Bot' : type === 'User' ? 'User' : '未設定'
      return dataWithSuccess(
        { ok: true, lastResult: null },
        { message: `${login} のタイプを ${typeLabel} に変更しました` },
      )
    })
    .with({ intent: 'confirm-toggle-active' }, () => {
      return data({ ok: false, lastResult: null, shouldConfirm: true })
    })
    .with({ intent: 'toggle-active' }, async ({ login, isActive }) => {
      try {
        await toggleGithubUserActive({
          login,
          isActive,
          organizationId: organization.id,
          currentUserId: user.id,
        })
      } catch (e) {
        return data(
          {
            ok: false,
            lastResult: submission.reply({ formErrors: [getErrorMessage(e)] }),
            shouldConfirm: true,
          },
          { status: 400 },
        )
      }
      const statusLabel = isActive ? 'ログイン許可' : 'ログイン拒否'
      return dataWithSuccess(
        { ok: true, lastResult: null },
        { message: `${login} を${statusLabel}に変更しました` },
      )
    })
    .exhaustive()
}

export default function GithubUsersPage({
  loaderData: { githubUsers, pagination, currentGithubLogin },
}: Route.ComponentProps) {
  const timezone = useTimezone()
  const columns = useMemo(() => createColumns(timezone), [timezone])

  return (
    <ContentSection
      title="GitHub Users"
      desc="Manage GitHub users linked to this organization."
      fullWidth
    >
      <GithubUsersTable
        data={githubUsers}
        columns={columns}
        pagination={pagination}
        currentGithubLogin={currentGithubLogin}
      />
    </ContentSection>
  )
}
