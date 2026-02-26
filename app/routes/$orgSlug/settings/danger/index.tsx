import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import ContentSection from '../+components/content-section'
import { DeleteOrganization } from '../_index/+forms/delete-organization'
import { deleteOrganization } from '../_index/+functions/mutations.server'
import { getOrganization } from '../_index/+functions/queries.server'
import { deleteOrganizationSchema as schema } from '../_index/+schema'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: ({ organization }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'Danger Zone',
    to: `/${organization.slug}/settings/danger`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization: orgContext } = await requireOrgAdmin(
    request,
    params.orgSlug,
  )
  const organization = await getOrganization(orgContext.id)
  if (!organization) {
    throw new Response('Organization not found', { status: 404 })
  }
  return { organization }
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization, membership } = await requireOrgAdmin(
    request,
    params.orgSlug,
  )
  if (membership.role !== 'owner') {
    throw new Response('Only the organization owner can delete it', {
      status: 403,
    })
  }

  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: 'delete-organization' as const,
      lastResult: submission.reply(),
    }
  }

  await deleteOrganization(organization.id)

  throw redirect('/')
}

export default function DangerZonePage({
  loaderData: { organization },
}: Route.ComponentProps) {
  return (
    <ContentSection
      title="Danger Zone"
      desc="Irreversible and destructive actions. Please proceed with caution."
    >
      <DeleteOrganization organization={organization} />
    </ContentSection>
  )
}
