import { parseWithZod } from '@conform-to/zod'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { nanoid } from 'nanoid'
import { jsonWithSuccess } from 'remix-toast'
import { z } from 'zod'
import { zx } from 'zodix'
import { insertExportSetting, updateExportSetting } from '../functions.server'
import { exportSettingsSchema as schema } from '../types'

const intent = 'export-settings' as const

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return json({
      intent,
      lastResult: submission.reply(),
    })
  }

  try {
    const { id, sheet_id, client_email, private_key } = submission.value
    if (id) {
      await updateExportSetting(id, {
        company_id: companyId,
        sheet_id,
        client_email,
        private_key,
        updated_at: new Date().toISOString(),
      })
    } else {
      await insertExportSetting({
        id: nanoid(),
        company_id: companyId,
        sheet_id,
        client_email,
        private_key,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
    }
  } catch (e) {
    return json({
      intent,
      lastResult: submission.reply({
        formErrors: [`Error saving export settings: ${String(e)}`],
      }),
    })
  }
  return jsonWithSuccess(
    {
      intent,
      lastResult: submission.reply(),
    },
    {
      message: 'Update export settings successfully',
    },
  )
}
