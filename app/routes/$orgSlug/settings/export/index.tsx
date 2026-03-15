import { parseWithZod } from '@conform-to/zod/v4'
import { dataWithSuccess } from 'remix-toast'
import { orgContext } from '~/app/middleware/context'
import ContentSection from '../+components/content-section'
import { ExportSettings } from '../_index/+forms/export-settings'
import { upsertExportSetting } from '../_index/+functions/mutations.server'
import { getExportSetting } from '../_index/+functions/queries.server'
import { exportSettingsSchema as schema } from '../_index/+schema'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Export',
    to: `/${params.orgSlug}/settings/export`,
  }),
}

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const exportSetting = await getExportSetting(organization.id)
  return { exportSetting }
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization } = context.get(orgContext)

  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: 'export-settings' as const,
      lastResult: submission.reply(),
    }
  }

  try {
    const { sheetId, clientEmail, privateKey } = submission.value
    await upsertExportSetting(organization.id, {
      sheetId,
      clientEmail,
      privateKey,
    })
  } catch (e) {
    return {
      intent: 'export-settings' as const,
      lastResult: submission.reply({
        formErrors: [`Error saving export settings: ${String(e)}`],
      }),
    }
  }
  return dataWithSuccess(
    {
      intent: 'export-settings' as const,
      lastResult: submission.reply(),
    },
    {
      message: 'Update export settings successfully',
    },
  )
}

export default function ExportSettingsPage({
  loaderData: { exportSetting },
}: Route.ComponentProps) {
  return (
    <ContentSection
      title="Export"
      desc="Configure Google Sheets export settings."
    >
      <ExportSettings exportSetting={exportSetting} />
    </ContentSection>
  )
}
