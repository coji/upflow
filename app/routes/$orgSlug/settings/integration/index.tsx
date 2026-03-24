import { parseWithZod } from '@conform-to/zod/v4'
import { href } from 'react-router'
import { dataWithError, dataWithSuccess } from 'remix-toast'
import { getErrorMessage } from '~/app/libs/error-message'
import { orgContext } from '~/app/middleware/context'
import { getIntegration } from '~/app/services/github-integration-queries.server'
import ContentSection from '../+components/content-section'
import { IntegrationSettings } from '../_index/+forms/integration-settings'
import { upsertIntegration } from '../_index/+functions/mutations.server'
import { integrationSettingsSchema as schema } from '../_index/+schema'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Integration',
    to: href('/:orgSlug/settings/integration', { orgSlug: params.orgSlug }),
  }),
}

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const integration = await getIntegration(organization.id)
  // Never send privateToken to the client
  const safeIntegration = integration
    ? {
        provider: integration.provider,
        method: integration.method,
        hasToken: !!integration.privateToken,
      }
    : undefined
  return { integration: safeIntegration }
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization } = context.get(orgContext)

  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: 'integration-settings' as const,
      lastResult: submission.reply(),
    }
  }

  try {
    const { privateToken, ...rest } = submission.value
    // If token is empty, keep existing; if new integration, require token
    if (!privateToken) {
      const existing = await getIntegration(organization.id)
      if (!existing?.privateToken) {
        const message = 'Private token is required for new integrations.'
        return dataWithError(
          {
            intent: 'integration-settings' as const,
            lastResult: submission.reply({ formErrors: [message] }),
          },
          { message },
        )
      }
      await upsertIntegration(organization.id, {
        ...rest,
        privateToken: existing.privateToken,
      })
    } else {
      await upsertIntegration(organization.id, { ...rest, privateToken })
    }
  } catch (e) {
    console.error('Failed to update integration:', e)
    const message = getErrorMessage(e)
    return dataWithError(
      {
        intent: 'integration-settings' as const,
        lastResult: submission.reply({ formErrors: [message] }),
      },
      { message },
    )
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
