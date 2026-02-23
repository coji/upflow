import { parseWithZod } from '@conform-to/zod/v4'
import { dataWithSuccess } from 'remix-toast'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import type { Route } from '../+types/_layout'
import {
  updateOrganization,
  updateOrganizationSetting,
} from '../+functions/mutations.server'
import { INTENTS, organizationSettingsSchema as schema } from '../+schema'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.organizationSettings,
      lastResult: submission.reply(),
    }
  }

  const { organization } = await requireOrgAdmin(request, params.orgSlug)

  const {
    name,
    releaseDetectionMethod,
    releaseDetectionKey,
    isActive,
    excludedUsers,
  } = submission.value

  try {
    await updateOrganization(organization.id, { name })
    await updateOrganizationSetting(organization.id, {
      releaseDetectionMethod,
      releaseDetectionKey,
      isActive,
      excludedUsers,
    })
  } catch (_e) {
    return {
      intent: INTENTS.organizationSettings,
      lastResult: submission.reply({
        formErrors: ['Failed to update organization'],
      }),
    }
  }

  return dataWithSuccess(
    {
      intent: INTENTS.organizationSettings,
      lastResult: submission.reply(),
    },
    {
      message: 'Organization updated successfully',
    },
  )
}
