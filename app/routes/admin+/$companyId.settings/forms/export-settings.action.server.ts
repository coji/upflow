import { parseWithZod } from '@conform-to/zod'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { nanoid } from 'nanoid'
import { jsonWithSuccess } from 'remix-toast'
import { z } from 'zod'
import { zx } from 'zodix'
import { insertExportSetting, updateExportSetting } from '../functions.server'
import { INTENTS, exportSettingsSchema as schema } from '../types'

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return json({
      intent: INTENTS.exportSettings,
      lastResult: submission.reply(),
    })
  }

  try {
    const { id, sheetId, clientEmail, privateKey } = submission.value
    if (id) {
      await updateExportSetting(id, {
        companyId,
        sheetId,
        clientEmail,
        privateKey,
        updatedAt: new Date().toISOString(),
      })
    } else {
      await insertExportSetting({
        id: nanoid(),
        companyId,
        sheetId,
        clientEmail,
        privateKey,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
    }
  } catch (e) {
    return json({
      intent: INTENTS.exportSettings,
      lastResult: submission.reply({
        formErrors: [`Error saving export settings: ${String(e)}`],
      }),
    })
  }
  return jsonWithSuccess(
    {
      intent: INTENTS.exportSettings,
      lastResult: submission.reply(),
    },
    {
      message: 'Update export settings successfully',
    },
  )
}
