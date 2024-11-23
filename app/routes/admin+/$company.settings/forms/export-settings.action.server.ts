import { parseWithZod } from '@conform-to/zod'
import { dataWithSuccess } from 'remix-toast'
import { upsertExportSetting } from '../functions.server'
import { INTENTS, exportSettingsSchema as schema } from '../types'
import type { Route } from './+types'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.exportSettings,
      lastResult: submission.reply(),
    }
  }

  try {
    const { id, sheetId, clientEmail, privateKey } = submission.value
    await upsertExportSetting(id, {
      companyId: params.company,
      sheetId,
      clientEmail,
      privateKey,
    })
  } catch (e) {
    return {
      intent: INTENTS.exportSettings,
      lastResult: submission.reply({
        formErrors: [`Error saving export settings: ${String(e)}`],
      }),
    }
  }
  return dataWithSuccess(
    {
      intent: INTENTS.exportSettings,
      lastResult: submission.reply(),
    },
    {
      message: 'Update export settings successfully',
    },
  )
}
