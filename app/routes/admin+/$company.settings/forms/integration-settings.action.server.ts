import { parseWithZod } from '@conform-to/zod'
import { jsonWithSuccess } from 'remix-toast'
import { upsertIntegration } from '../functions.server'
import { INTENTS, integrationSettingsSchema as schema } from '../types'
import type { Route } from './+types'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.integrationSettings,
      lastResult: submission.reply(),
    }
  }

  try {
    const { id, ...rest } = submission.value
    await upsertIntegration(id, { ...rest, companyId: params.company })
  } catch (e) {
    return {
      intent: INTENTS.integrationSettings,
      lastResult: submission.reply({
        formErrors: [`Integration upsert failed: ${String(e)}`],
      }),
    }
  }

  return jsonWithSuccess(
    {
      intent: INTENTS.integrationSettings,
      lastResult: submission.reply(),
    },
    {
      message: 'Update export settings successfully',
    },
  )
}
