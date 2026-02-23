import { parseWithZod } from '@conform-to/zod/v4'
import { dataWithSuccess } from 'remix-toast'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import type { Route } from '../+types/route'
import { upsertIntegration } from '../functions.server'
import { INTENTS, integrationSettingsSchema as schema } from '../types'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.integrationSettings,
      lastResult: submission.reply(),
    }
  }

  const { organization } = await requireOrgAdmin(request, params.orgSlug)

  try {
    const { id, ...rest } = submission.value
    await upsertIntegration(id, {
      ...rest,
      organizationId: organization.id,
    })
  } catch (e) {
    return {
      intent: INTENTS.integrationSettings,
      lastResult: submission.reply({
        formErrors: [`Integration upsert failed: ${String(e)}`],
      }),
    }
  }

  return dataWithSuccess(
    {
      intent: INTENTS.integrationSettings,
      lastResult: submission.reply(),
    },
    {
      message: 'Update export settings successfully',
    },
  )
}
