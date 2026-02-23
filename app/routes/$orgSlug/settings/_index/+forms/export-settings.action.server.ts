import { parseWithZod } from '@conform-to/zod/v4'
import { dataWithSuccess } from 'remix-toast'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import { INTENTS, exportSettingsSchema as schema } from '../+schema'
import type { Route } from '../+types/_layout'
import { upsertExportSetting } from '../functions.server'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.exportSettings,
      lastResult: submission.reply(),
    }
  }

  const { organization } = await requireOrgAdmin(request, params.orgSlug)

  try {
    const { id, sheetId, clientEmail, privateKey } = submission.value
    await upsertExportSetting(id, {
      organizationId: organization.id,
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
