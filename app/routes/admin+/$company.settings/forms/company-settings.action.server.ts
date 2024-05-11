import { parseWithZod } from '@conform-to/zod'
import type { ActionFunctionArgs } from '@remix-run/node'
import { jsonWithSuccess } from 'remix-toast'
import { z } from 'zod'
import { zx } from 'zodix'
import { updateCompany } from '../functions/mutations.server'
import { INTENTS, companySettingsSchema as schema } from '../types'

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { company: companyId } = zx.parseParams(params, { company: z.string() })
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.companySettings,
      lastResult: submission.reply(),
    }
  }

  try {
    await updateCompany(companyId, submission.value)
  } catch (e) {
    return {
      intent: INTENTS.companySettings,
      lastResult: submission.reply({
        formErrors: ['Failed to update company'],
      }),
    }
  }

  return jsonWithSuccess(
    {
      intent: INTENTS.companySettings,
      lastResult: submission.reply(),
    },
    {
      message: 'Company updated successfully',
    },
  )
}
