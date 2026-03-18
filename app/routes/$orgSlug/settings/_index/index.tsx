import { parseWithZod } from '@conform-to/zod/v4'
import { dataWithSuccess } from 'remix-toast'
import { orgContext } from '~/app/middleware/context'
import ContentSection from '../+components/content-section'
import { OrganizationSettings } from './+forms/organization-settings'
import {
  updateOrganization,
  updateOrganizationSetting,
} from './+functions/mutations.server'
import {
  createDefaultOrganizationSetting,
  getOrganization,
  getOrganizationSetting,
} from './+functions/queries.server'
import { organizationSettingsSchema as schema } from './+schema'
import type { Route } from './+types/index'

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { organization: org } = context.get(orgContext)
  const organization = await getOrganization(org.id)
  if (!organization) {
    throw new Response('Organization not found', { status: 404 })
  }
  const organizationSetting =
    (await getOrganizationSetting(org.id)) ??
    (await createDefaultOrganizationSetting(org.id))

  return { organization, organizationSetting }
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization } = context.get(orgContext)

  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: 'organization-settings' as const,
      lastResult: submission.reply(),
    }
  }

  const {
    name,
    releaseDetectionMethod,
    releaseDetectionKey,
    isActive,
    timezone,
    language,
  } = submission.value

  try {
    await updateOrganization(organization.id, { name })
    await updateOrganizationSetting(organization.id, {
      releaseDetectionMethod,
      releaseDetectionKey,
      isActive,
      timezone,
      language,
    })
  } catch (_e) {
    return {
      intent: 'organization-settings' as const,
      lastResult: submission.reply({
        formErrors: ['Failed to update organization'],
      }),
    }
  }

  return dataWithSuccess(
    {
      intent: 'organization-settings' as const,
      lastResult: submission.reply(),
    },
    {
      message: 'Organization updated successfully',
    },
  )
}

export default function GeneralSettingsPage({
  loaderData: { organization, organizationSetting },
}: Route.ComponentProps) {
  return (
    <ContentSection title="General" desc="Manage your organization settings.">
      <OrganizationSettings
        organization={organization}
        organizationSetting={organizationSetting}
      />
    </ContentSection>
  )
}
