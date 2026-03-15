import { useMemo } from 'react'
import { data, href } from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { useTimezone } from '~/app/hooks/use-timezone'
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

const addSchema = z.object({
  login: z.string().min(1),
  displayName: z.string().min(1),
})

const updateSchema = z.object({
  login: z.string().min(1),
  displayName: z.string().min(1),
})

const deleteSchema = z.object({
  login: z.string().min(1),
})

const updateTypeSchema = z.object({
  login: z.string().min(1),
  type: z.preprocess(
    (v) => (v === '' ? null : v),
    z.enum(['User', 'Bot']).nullable(),
  ),
})

const toggleActiveSchema = z.object({
  login: z.string().min(1),
  isActive: z.coerce
    .number()
    .int()
    .min(0)
    .max(1)
    .pipe(z.union([z.literal(0), z.literal(1)])),
})

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization, user } = context.get(orgContext)
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  return match(intent)
    .with('add', async () => {
      const parsed = addSchema.safeParse({
        login: formData.get('login'),
        displayName: formData.get('displayName'),
      })
      if (!parsed.success) {
        return data({ error: 'Invalid input' }, { status: 400 })
      }
      await addGithubUser({ ...parsed.data, organizationId: organization.id })
      return data({ ok: true })
    })
    .with('update', async () => {
      const parsed = updateSchema.safeParse({
        login: formData.get('login'),
        displayName: formData.get('displayName'),
      })
      if (!parsed.success) {
        return data({ error: 'Invalid input' }, { status: 400 })
      }
      await updateGithubUser({
        ...parsed.data,
        organizationId: organization.id,
      })
      return data({ ok: true })
    })
    .with('delete', async () => {
      const parsed = deleteSchema.safeParse({
        login: formData.get('login'),
      })
      if (!parsed.success) {
        return data({ error: 'Invalid input' }, { status: 400 })
      }
      try {
        await deleteGithubUser(parsed.data.login, organization.id, user.id)
      } catch (e) {
        return data({ error: String(e) }, { status: 400 })
      }
      return data({ ok: true })
    })
    .with('update-type', async () => {
      const parsed = updateTypeSchema.safeParse({
        login: formData.get('login'),
        type: formData.get('type'),
      })
      if (!parsed.success) {
        return data({ error: 'Invalid input' }, { status: 400 })
      }
      await updateGithubUserType({
        ...parsed.data,
        organizationId: organization.id,
      })
      return data({ ok: true })
    })
    .with('toggle-active', async () => {
      const parsed = toggleActiveSchema.safeParse({
        login: formData.get('login'),
        isActive: formData.get('isActive'),
      })
      if (!parsed.success) {
        return data({ error: 'Invalid input' }, { status: 400 })
      }
      try {
        await toggleGithubUserActive({
          ...parsed.data,
          organizationId: organization.id,
          currentUserId: user.id,
        })
      } catch (e) {
        return data({ error: String(e) }, { status: 400 })
      }
      return data({ ok: true })
    })
    .otherwise(() => data({ error: 'Invalid intent' }, { status: 400 }))
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
