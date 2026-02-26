import { parseWithZod } from '@conform-to/zod/v4'
import { dataWithSuccess } from 'remix-toast'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import ContentSection from '../+components/content-section'
import { ExportSettings } from '../_index/+forms/export-settings'
import { upsertExportSetting } from '../_index/+functions/mutations.server'
import { getExportSetting } from '../_index/+functions/queries.server'
import { exportSettingsSchema as schema } from '../_index/+schema'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: ({ organization }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'Export',
    to: `/${organization.slug}/settings/export`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const exportSetting = await getExportSetting(organization.id)
  return { organization, exportSetting }
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)

  const submission = await parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: 'export-settings' as const,
      lastResult: submission.reply(),
    }
  }

  try {
    const { sheetId, clientEmail, privateKey } = submission.value
    await upsertExportSetting({
      organizationId: organization.id,
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
