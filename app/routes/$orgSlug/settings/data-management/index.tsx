import { data, useFetcher } from 'react-router'
import { match } from 'ts-pattern'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Stack,
} from '~/app/components/ui'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import dayjs from '~/app/libs/dayjs'
import { getTenantDb } from '~/app/services/tenant-db.server'
import { createSpreadsheetExporter } from '~/batch/bizlogic/export-spreadsheet'
import { getOrganization, upsertPullRequest } from '~/batch/db'
import { createProvider } from '~/batch/provider'
import ContentSection from '../+components/content-section'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Data Management',
    to: `/${params.orgSlug}/settings/data-management`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)

  const tenantDb = getTenantDb(organization.id)
  const organizationSetting = await tenantDb
    .selectFrom('organizationSettings')
    .select(['refreshRequestedAt'])
    .executeTakeFirst()

  return {
    refreshRequestedAt: organizationSetting?.refreshRequestedAt ?? null,
  }
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization: orgContext } = await requireOrgAdmin(
    request,
    params.orgSlug,
  )
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  return match(intent)
    .with('refresh', async () => {
      const tenantDb = getTenantDb(orgContext.id)
      await tenantDb
        .updateTable('organizationSettings')
        .set({ refreshRequestedAt: new Date().toISOString() })
        .execute()

      return data({ intent: 'refresh' as const, ok: true })
    })
    .with('recalculate', async () => {
      const organization = await getOrganization(orgContext.id)
      if (!organization.integration) {
        return data(
          {
            intent: 'recalculate' as const,
            error: 'No integration configured',
          },
          { status: 400 },
        )
      }
      if (!organization.organizationSetting) {
        return data(
          { intent: 'recalculate' as const, error: 'No organization setting' },
          { status: 400 },
        )
      }

      const provider = createProvider(organization.integration)
      if (!provider) {
        return data(
          {
            intent: 'recalculate' as const,
            error: `Unknown provider: ${organization.integration.provider}`,
          },
          { status: 400 },
        )
      }

      try {
        const { pulls, reviewResponses } = await provider.analyze(
          orgContext.id,
          organization.organizationSetting,
          organization.repositories,
        )

        for (const pr of pulls) {
          await upsertPullRequest(orgContext.id, pr)
        }

        if (organization.exportSetting) {
          const exporter = createSpreadsheetExporter(organization.exportSetting)
          await exporter.exportPulls(pulls)
          await exporter.exportReviewResponses(reviewResponses)
        }

        return data({
          intent: 'recalculate' as const,
          ok: true,
          message: `Recalculation completed. ${pulls.length} PRs updated.`,
        })
      } catch (e) {
        console.error(
          'Recalculation failed:',
          e instanceof Error ? e.message : 'Unknown error',
        )
        return data(
          {
            intent: 'recalculate' as const,
            error: e instanceof Error ? e.message : 'Recalculation failed',
          },
          { status: 500 },
        )
      }
    })
    .otherwise(() => data({ error: 'Invalid intent' }, { status: 400 }))
}

// --- Refresh Section ---

function RefreshSection({
  refreshRequestedAt,
}: {
  refreshRequestedAt: string | null
}) {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== 'idle'
  const isScheduled =
    refreshRequestedAt != null ||
    (fetcher.data?.intent === 'refresh' && fetcher.data?.ok === true)

  return (
    <Stack>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            Schedule Full Refresh
            {isScheduled && <Badge variant="secondary">Scheduled</Badge>}
          </p>
          <p className="text-muted-foreground text-xs">
            Re-fetch all PR data from GitHub on the next hourly crawl.
          </p>
        </div>
        <fetcher.Form method="post" className="shrink-0">
          <input type="hidden" name="intent" value="refresh" />
          <Button type="submit" loading={isSubmitting} disabled={isScheduled}>
            {isScheduled ? 'Scheduled' : 'Schedule'}
          </Button>
        </fetcher.Form>
      </div>
      {isScheduled && refreshRequestedAt && (
        <Alert>
          <AlertDescription>
            Scheduled at{' '}
            {dayjs(refreshRequestedAt).format('YYYY-MM-DD HH:mm:ss')}. It will
            run on the next crawl job.
          </AlertDescription>
        </Alert>
      )}
      {fetcher.data?.error && (
        <Alert variant="destructive">
          <AlertDescription>{fetcher.data.error}</AlertDescription>
        </Alert>
      )}
    </Stack>
  )
}

// --- Recalculate Section ---

function RecalculateSection() {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== 'idle'

  return (
    <Stack>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Recalculate Cycle Times</p>
          <p className="text-muted-foreground text-xs">
            Recalculate pickup/review/deploy times based on current excluded
            users settings.
          </p>
        </div>
        <fetcher.Form method="post" className="shrink-0">
          <input type="hidden" name="intent" value="recalculate" />
          <Button type="submit" loading={isSubmitting}>
            Recalculate
          </Button>
        </fetcher.Form>
      </div>
      {fetcher.data?.intent === 'recalculate' && fetcher.data?.ok === true && (
        <Alert>
          <AlertDescription>{fetcher.data.message}</AlertDescription>
        </Alert>
      )}
      {fetcher.data?.intent === 'recalculate' && fetcher.data?.error && (
        <Alert variant="destructive">
          <AlertDescription>{fetcher.data.error}</AlertDescription>
        </Alert>
      )}
    </Stack>
  )
}

// --- Page ---

export default function DataManagementPage({
  loaderData: { refreshRequestedAt },
}: Route.ComponentProps) {
  return (
    <ContentSection
      title="Data Management"
      desc="Manage data refresh and recalculation for this organization."
    >
      <Stack gap="6">
        <RefreshSection refreshRequestedAt={refreshRequestedAt} />
        <RecalculateSection />
      </Stack>
    </ContentSection>
  )
}
