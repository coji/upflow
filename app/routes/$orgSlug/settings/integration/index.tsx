import { parseWithZod } from '@conform-to/zod/v4'
import { dataWithSuccess } from 'remix-toast'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import ContentSection from '../+components/content-section'
import { IntegrationSettings } from '../_index/+forms/integration-settings'
import { upsertIntegration } from '../_index/+functions/mutations.server'
import { getIntegration } from '../_index/+functions/queries.server'
import { integrationSettingsSchema as schema } from '../_index/+schema'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Integration',
    to: `/${params.orgSlug}/settings/integration`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const integration = await getIntegration(organization.id)
  return { integration }
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)

  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: 'integration-settings' as const,
      lastResult: submission.reply(),
    }
  }

  try {
    await upsertIntegration({
      ...submission.value,
      organizationId: organization.id,
    })
  } catch (e) {
    console.error('Integration upsert failed', e)
    return {
      intent: 'integration-settings' as const,
      lastResult: submission.reply({
        formErrors: ['Integration upsert failed. Please try again.'],
      }),
    }
  }

  return dataWithSuccess(
    {
      intent: 'integration-settings' as const,
      lastResult: submission.reply(),
    },
    {
      message: 'Update integration settings successfully',
    },
  )
}

export default function IntegrationSettingsPage({
  loaderData: { integration },
}: Route.ComponentProps) {
  return (
    <ContentSection
      title="Integration"
      desc="Configure your GitHub integration settings."
    >
      <IntegrationSettings integration={integration} />
    </ContentSection>
  )
}
