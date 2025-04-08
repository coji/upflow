import { parseWithZod } from '@conform-to/zod'
import { dataWithSuccess } from 'remix-toast'
import type { Route } from '../+types/route'
import { updateOrganization } from '../functions/mutations.server'
import { INTENTS, organizationSettingsSchema as schema } from '../types'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.organizationSettings,
      lastResult: submission.reply(),
    }
  }

  try {
    await updateOrganization(params.organization, submission.value)
  } catch (e) {
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
