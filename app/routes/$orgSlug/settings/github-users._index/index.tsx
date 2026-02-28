import { data } from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import ContentSection from '../+components/content-section'
import { columns } from './+components/github-users-columns'
import { GithubUsersTable } from './+components/github-users-table'
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
} from './mutations.server'
import { listFilteredGithubUsers } from './queries.server'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'GitHub Users',
    to: `/${params.orgSlug}/settings/github-users`,
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

  return { githubUsers, pagination }
}

const addSchema = z.object({
  login: z.string().min(1),
  displayName: z.string().min(1),
})

const updateSchema = z.object({
  login: z.string().min(1),
  displayName: z.string().min(1),
  name: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
})

const deleteSchema = z.object({
  login: z.string().min(1),
})

const toggleActiveSchema = z.object({
  login: z.string().min(1),
  isActive: z.coerce.number().int().min(0).max(1) as z.ZodType<0 | 1>,
})

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  return match(intent)
    .with('add', async () => {
      const parsed = addSchema.parse({
        login: formData.get('login'),
        displayName: formData.get('displayName'),
      })
      await addGithubUser({ ...parsed, organizationId: organization.id })
      return data({ ok: true })
    })
    .with('update', async () => {
      const parsed = updateSchema.parse({
        login: formData.get('login'),
        displayName: formData.get('displayName'),
        name: formData.get('name') || null,
        email: formData.get('email') || null,
      })
      await updateGithubUser({ ...parsed, organizationId: organization.id })
      return data({ ok: true })
    })
    .with('delete', async () => {
      const { login } = deleteSchema.parse({ login: formData.get('login') })
      await deleteGithubUser(login, organization.id)
      return data({ ok: true })
    })
    .with('toggle-active', async () => {
      const parsed = toggleActiveSchema.parse({
        login: formData.get('login'),
        isActive: formData.get('isActive'),
      })
      await toggleGithubUserActive({
        ...parsed,
        organizationId: organization.id,
      })
      return data({ ok: true })
    })
    .otherwise(() => data({ error: 'Invalid intent' }, { status: 400 }))
}

export default function GithubUsersPage({
  loaderData: { githubUsers, pagination },
}: Route.ComponentProps) {
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
      />
    </ContentSection>
  )
}
