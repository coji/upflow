import { parseWithZod } from '@conform-to/zod'
import type { ActionFunctionArgs } from '@remix-run/node'
import { jsonWithSuccess } from 'remix-toast'
import { z } from 'zod'
import { zx } from 'zodix'
import { upsertIntegration } from '../functions.server'
import { INTENTS, integrationSettingsSchema as schema } from '../types'

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.integrationSettings,
      lastResult: submission.reply(),
    }
  }

  try {
    const { id, ...rest } = submission.value
    await upsertIntegration(id, { ...rest, companyId })
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
