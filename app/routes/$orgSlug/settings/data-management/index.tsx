import { useState } from 'react'
import { data, href, useFetcher } from 'react-router'
import { match } from 'ts-pattern'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Checkbox,
  Label,
  Stack,
} from '~/app/components/ui'
import { Progress } from '~/app/components/ui/progress'
import { useTimezone } from '~/app/hooks/use-timezone'
import dayjs from '~/app/libs/dayjs'
import { orgContext } from '~/app/middleware/context'
import { durably } from '~/app/services/durably'
import { durably as serverDurably } from '~/app/services/durably.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { AnalyzeAndUpsertSteps } from '~/batch/usecases/analyze-and-upsert'
import ContentSection from '../+components/content-section'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Data Management',
    to: href('/:orgSlug/settings/data-management', { orgSlug: params.orgSlug }),
  }),
}

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)

  const tenantDb = getTenantDb(organization.id)
  const organizationSetting = await tenantDb
    .selectFrom('organizationSettings')
    .select(['refreshRequestedAt'])
    .executeTakeFirst()

  return {
    refreshRequestedAt: organizationSetting?.refreshRequestedAt ?? null,
  }
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization: org } = context.get(orgContext)
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  return match(intent)
    .with('refresh', async () => {
      const tenantDb = getTenantDb(org.id)
      await tenantDb
        .updateTable('organizationSettings')
        .set({ refreshRequestedAt: new Date().toISOString() })
        .execute()

      return data({ intent: 'refresh' as const, ok: true })
    })
    .with('recalculate', async () => {
      const selectedSteps = formData.getAll('steps').map(String)
      const steps = {
        upsert: selectedSteps.includes('upsert'),
        classify: selectedSteps.includes('classify'),
        export: selectedSteps.includes('export'),
      } satisfies AnalyzeAndUpsertSteps

      if (!steps.upsert && !steps.classify && !steps.export) {
        return data(
          {
            intent: 'recalculate' as const,
            error: 'At least one step must be selected',
          },
          { status: 400 },
        )
      }

      const run = await serverDurably.jobs.recalculate.trigger(
        { organizationId: org.id, steps },
        {
          concurrencyKey: `recalculate:${org.id}`,
          labels: { organizationId: org.id },
        },
      )

      return data({
        intent: 'recalculate' as const,
        ok: true,
        runId: run.id,
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
  const timezone = useTimezone()
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
            {dayjs
              .utc(refreshRequestedAt)
              .tz(timezone)
              .format('YYYY-MM-DD HH:mm:ss')}
            . It will run on the next crawl job.
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
  const [upsert, setUpsert] = useState(true)
  const [classify, setClassify] = useState(false)
  const [exportData, setExportData] = useState(false)
  const noneSelected = !upsert && !classify && !exportData

  // After form submission, track the durably run via SSE
  const runId =
    fetcher.data?.intent === 'recalculate' && fetcher.data?.ok
      ? fetcher.data.runId
      : null
  const {
    progress,
    output,
    error: runError,
    isPending,
    isLeased,
    isCompleted,
    isFailed,
  } = durably.recalculate.useRun(runId)

  const isRunning = isPending || isLeased
  const isSubmitting = fetcher.state !== 'idle'

  return (
    <Stack>
      <div className="space-y-1">
        <p className="text-sm font-medium">Recalculate Cycle Times</p>
        <p className="text-muted-foreground text-xs">
          Re-analyze PR data from stored raw data. Select which steps to run.
        </p>
      </div>
      <fetcher.Form method="post">
        <Stack gap="4">
          <input type="hidden" name="intent" value="recalculate" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="step-upsert"
                name="steps"
                value="upsert"
                checked={upsert}
                onCheckedChange={(c) => setUpsert(c === true)}
                disabled={isRunning}
              />
              <Label htmlFor="step-upsert" className="text-xs">
                Analyze & Upsert — Re-analyze and update PR data in DB
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="step-classify"
                name="steps"
                value="classify"
                checked={classify}
                onCheckedChange={(c) => setClassify(c === true)}
                disabled={isRunning}
              />
              <Label htmlFor="step-classify" className="text-xs">
                LLM Classify — Classify PR size/risk with Gemini
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="step-export"
                name="steps"
                value="export"
                checked={exportData}
                onCheckedChange={(c) => setExportData(c === true)}
                disabled={isRunning}
              />
              <Label htmlFor="step-export" className="text-xs">
                Export to Spreadsheet
              </Label>
            </div>
          </div>
          <div>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={noneSelected || isRunning}
            >
              Recalculate
            </Button>
          </div>
        </Stack>
      </fetcher.Form>

      {/* Progress */}
      {isRunning && progress && (
        <Alert>
          <AlertDescription>
            <div className="space-y-2">
              <p className="text-sm">{progress.message ?? 'Processing...'}</p>
              {progress.total != null && progress.total > 0 && (
                <Progress
                  value={(progress.current / progress.total) * 100}
                  className="h-2"
                />
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {isRunning && !progress && (
        <Alert>
          <AlertDescription>Starting recalculation...</AlertDescription>
        </Alert>
      )}

      {/* Success */}
      {isCompleted && (
        <Alert>
          <AlertDescription>
            Recalculation completed.{' '}
            {output?.pullCount != null && `${output.pullCount} PRs updated.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Error */}
      {isFailed && (
        <Alert variant="destructive">
          <AlertDescription>Recalculation failed. {runError}</AlertDescription>
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

// --- Export Data Section ---

function ExportDataSection({ orgSlug }: { orgSlug: string }) {
  const [includeRaw, setIncludeRaw] = useState(false)

  const handleDownload = () => {
    const params = includeRaw ? '?includeRaw=true' : ''
    window.location.assign(
      href('/:orgSlug/settings/data-management/export-parquet', {
        orgSlug,
      }) + params,
    )
  }

  return (
    <Stack>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Export PR Data</p>
          <p className="text-muted-foreground text-xs">
            Download all PR data as a Parquet file bundled with a data
            dictionary. Analyze locally with DuckDB or Claude Code.
          </p>
        </div>
        <Button type="button" onClick={handleDownload} className="shrink-0">
          Download
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="include-raw"
          checked={includeRaw}
          onCheckedChange={(checked) => setIncludeRaw(checked === true)}
        />
        <Label htmlFor="include-raw" className="text-xs">
          Include raw GitHub API data (larger file)
        </Label>
      </div>
    </Stack>
  )
}

// --- Page ---

export default function DataManagementPage({
  loaderData: { refreshRequestedAt },
  params: { orgSlug },
}: Route.ComponentProps) {
  return (
    <ContentSection
      title="Data Management"
      desc="Manage data refresh and recalculation for this organization."
    >
      <Stack gap="6">
        <RefreshSection refreshRequestedAt={refreshRequestedAt} />
        <RecalculateSection />
        <ExportDataSection orgSlug={orgSlug} />
      </Stack>
    </ContentSection>
  )
}
