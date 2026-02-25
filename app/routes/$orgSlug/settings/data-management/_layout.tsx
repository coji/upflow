import { data, useFetcher } from 'react-router'
import { match } from 'ts-pattern'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Stack,
} from '~/app/components/ui'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import dayjs from '~/app/libs/dayjs'
import { db } from '~/app/services/db.server'
import { createSpreadsheetExporter } from '~/batch/bizlogic/export-spreadsheet'
import { getOrganization, upsertPullRequest } from '~/batch/db'
import { createProvider } from '~/batch/provider'
import type { Route } from './+types/_layout'

export const handle = {
  breadcrumb: ({ organization }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'Data Management',
    to: `/${organization.slug}/settings/data-management`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)

  const organizationSetting = await db
    .selectFrom('organizationSettings')
    .select(['refreshRequestedAt'])
    .where('organizationId', '=', organization.id)
    .executeTakeFirst()

  return {
    organization,
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
      await db
        .updateTable('organizationSettings')
        .set({ refreshRequestedAt: new Date().toISOString() })
        .where('organizationId', '=', orgContext.id)
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

      const { pulls, reviewResponses } = await provider.analyze(
        organization.organizationSetting,
        organization.repositories,
      )

      for (const pr of pulls) {
        await upsertPullRequest(pr)
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Schedule Full Refresh
          {isScheduled && <Badge variant="secondary">Scheduled</Badge>}
        </CardTitle>
        <CardDescription>
          Queue a full re-fetch of all PR data from GitHub on the next scheduled
          crawl (runs every 30 minutes).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isScheduled && (
          <Alert>
            <AlertDescription>
              Full refresh scheduled
              {refreshRequestedAt &&
                ` at ${dayjs(refreshRequestedAt).format('YYYY-MM-DD HH:mm:ss')}`}
              . It will run on the next crawl job.
            </AlertDescription>
          </Alert>
        )}
        {fetcher.data?.error && (
          <Alert variant="destructive">
            <AlertDescription>{fetcher.data.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="refresh" />
          <Button type="submit" disabled={isScheduled || isSubmitting}>
            {isScheduled ? 'Refresh Scheduled' : 'Schedule Full Refresh'}
          </Button>
        </fetcher.Form>
      </CardFooter>
    </Card>
  )
}

// --- Recalculate Section ---

function RecalculateSection() {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== 'idle'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recalculate Cycle Times</CardTitle>
        <CardDescription>
          Recalculate pickup/review/deploy times based on current excluded users
          settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {fetcher.data?.intent === 'recalculate' &&
          fetcher.data?.ok === true && (
            <Alert>
              <AlertDescription>{fetcher.data.message}</AlertDescription>
            </Alert>
          )}
        {fetcher.data?.intent === 'recalculate' && fetcher.data?.error && (
          <Alert variant="destructive">
            <AlertDescription>{fetcher.data.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="recalculate" />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : 'Recalculate'}
          </Button>
        </fetcher.Form>
      </CardFooter>
    </Card>
  )
}

// --- Page ---

export default function DataManagementPage({
  loaderData: { refreshRequestedAt },
}: Route.ComponentProps) {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Data Management</PageHeaderTitle>
          <PageHeaderDescription>
            Manage data refresh and recalculation for this organization.
          </PageHeaderDescription>
        </PageHeaderHeading>
      </PageHeader>
      <Stack>
        <RefreshSection refreshRequestedAt={refreshRequestedAt} />
        <RecalculateSection />
      </Stack>
    </>
  )
}
