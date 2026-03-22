import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import { dataWithError } from 'remix-toast'
import { getErrorMessage } from '~/app/libs/error-message'
import { orgContext } from '~/app/middleware/context'
import ContentSection from '../+components/content-section'
import { DeleteOrganization } from '../_index/+forms/delete-organization'
import { deleteOrganization } from '../_index/+functions/mutations.server'
import { getOrganization } from '../_index/+functions/queries.server'
import { deleteOrganizationSchema as schema } from '../_index/+schema'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Danger Zone',
    to: href('/:orgSlug/settings/danger', { orgSlug: params.orgSlug }),
  }),
}

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { organization: org } = context.get(orgContext)
  const organization = await getOrganization(org.id)
  if (!organization) {
    throw new Response('Organization not found', { status: 404 })
  }
  return { organization }
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization, membership } = context.get(orgContext)
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

  try {
    await deleteOrganization(organization.id)
  } catch (e) {
    const message = getErrorMessage(e)
    return dataWithError(
      {
        intent: 'delete-organization' as const,
        lastResult: submission.reply({ formErrors: [message] }),
      },
      { message },
    )
  }

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
