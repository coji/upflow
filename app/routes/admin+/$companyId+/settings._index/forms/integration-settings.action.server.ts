import { parseWithZod } from '@conform-to/zod'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { nanoid } from 'nanoid'
import { jsonWithSuccess } from 'remix-toast'
import { z } from 'zod'
import { zx } from 'zodix'
import { insertIntegration, updateIntegration } from '../functions.server'
import { INTENTS, integrationSettingsSchema as schema } from '../types'

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return json({
      intent: INTENTS.integrationSettings,
      lastResult: submission.reply(),
    })
  }

  try {
    const { id, ...rest } = submission.value
    if (id) {
      await updateIntegration(id, rest)
    } else {
      await insertIntegration({ id: nanoid(), company_id: companyId, ...rest })
    }
  } catch (e) {
    return json({
      intent: INTENTS.integrationSettings,
      lastResult: submission.reply({
        formErrors: [`Integration creation failed: ${String(e)}`],
      }),
    })
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
