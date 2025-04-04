import { parseWithZod } from '@conform-to/zod'
import { dataWithSuccess } from 'remix-toast'
import type { Route } from '../+types/route'
import { updateCompany } from '../functions/mutations.server'
import { INTENTS, companySettingsSchema as schema } from '../types'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.companySettings,
      lastResult: submission.reply(),
    }
  }

  try {
    await updateCompany(params.company, submission.value)
  } catch (e) {
    return {
      intent: INTENTS.companySettings,
      lastResult: submission.reply({
        formErrors: ['Failed to update company'],
      }),
    }
  }

  return dataWithSuccess(
    {
      intent: INTENTS.companySettings,
      lastResult: submission.reply(),
    },
    {
      message: 'Company updated successfully',
    },
  )
}
