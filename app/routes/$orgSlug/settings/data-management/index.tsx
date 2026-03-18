import { useState } from 'react'
import { data, href, useFetcher, useLoaderData } from 'react-router'
import { match } from 'ts-pattern'
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Label,
  Stack,
} from '~/app/components/ui'
import { orgContext } from '~/app/middleware/context'
import { durably } from '~/app/services/durably'
import { durably as serverDurably } from '~/app/services/durably.server'
import type { JobSteps } from '~/app/services/jobs/shared-steps.server'
import ContentSection from '../+components/content-section'
import { JobHistory, isRunActive } from './+components/job-history'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Data Management',
    to: href('/:orgSlug/settings/data-management', { orgSlug: params.orgSlug }),
  }),
}

export const loader = ({ context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  return data({ organizationId: organization.id })
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization: org } = context.get(orgContext)
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  return match(intent)
    .with('refresh', async () => {
      try {
        await serverDurably.jobs.crawl.trigger(
          { organizationId: org.id, refresh: true },
          {
            concurrencyKey: `crawl:${org.id}`,
            labels: { organizationId: org.id },
          },
        )
        return data({ intent: 'refresh' as const, ok: true })
      } catch {
        return data(
          { intent: 'refresh' as const, error: 'Failed to start refresh' },
          { status: 500 },
        )
      }
    })
    .with('recalculate', async () => {
      const selectedSteps = formData.getAll('steps').map(String)
      const steps = {
        upsert: selectedSteps.includes('upsert'),
        export: selectedSteps.includes('export'),
      } satisfies JobSteps

      if (!steps.upsert && !steps.export) {
        return data(
          {
            intent: 'recalculate' as const,
            error: 'At least one step must be selected',
          },
          { status: 400 },
        )
      }

      try {
        await serverDurably.jobs.recalculate.trigger(
          { organizationId: org.id, steps },
          {
            concurrencyKey: `recalculate:${org.id}`,
            labels: { organizationId: org.id },
          },
        )
        return data({ intent: 'recalculate' as const, ok: true })
      } catch {
        return data(
          {
            intent: 'recalculate' as const,
            error: 'Failed to start recalculation',
          },
          { status: 500 },
        )
      }
    })
    .otherwise(() => data({ error: 'Invalid intent' }, { status: 400 }))
}

// --- Refresh Section ---

function RefreshSection({ isRunning }: { isRunning: boolean }) {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== 'idle'
  const triggerError =
    fetcher.data?.intent === 'refresh' ? fetcher.data?.error : null

  return (
    <Stack>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Full Refresh</p>
          <p className="text-muted-foreground text-xs">
            Re-fetch all PR data from GitHub immediately.
          </p>
        </div>
        <fetcher.Form method="post" className="shrink-0">
          <input type="hidden" name="intent" value="refresh" />
          <Button type="submit" loading={isSubmitting} disabled={isRunning}>
            {isRunning ? 'Running' : 'Refresh'}
          </Button>
        </fetcher.Form>
      </div>

      {triggerError && (
        <Alert variant="destructive">
          <AlertDescription>{triggerError}</AlertDescription>
        </Alert>
      )}
    </Stack>
  )
}

// --- Recalculate Section ---

function RecalculateSection({ isRunning }: { isRunning: boolean }) {
  const fetcher = useFetcher()
  const [upsert, setUpsert] = useState(true)
  const [exportData, setExportData] = useState(false)
  const noneSelected = !upsert && !exportData
  const isSubmitting = fetcher.state !== 'idle'
  const triggerError =
    fetcher.data?.intent === 'recalculate' ? fetcher.data?.error : null

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

      {triggerError && (
        <Alert variant="destructive">
          <AlertDescription>{triggerError}</AlertDescription>
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
  params: { orgSlug },
}: Route.ComponentProps) {
  const { organizationId } = useLoaderData<typeof loader>()

  const { runs, page, hasMore, isLoading, nextPage, prevPage } =
    durably.useRuns({
      labels: { organizationId },
      pageSize: 10,
    })

  const {
    cancel,
    retrigger,
    isLoading: isActing,
    error: actionError,
  } = durably.useRunActions()

  const isCrawlRunning = runs.some(
    (r) => r.jobName === 'crawl' && isRunActive(r.status),
  )
  const isRecalculateRunning = runs.some(
    (r) => r.jobName === 'recalculate' && isRunActive(r.status),
  )

  return (
    <ContentSection
      title="Data Management"
      desc="Manage data refresh and recalculation for this organization."
    >
      <Stack gap="6">
        <RefreshSection isRunning={isCrawlRunning} />
        <RecalculateSection isRunning={isRecalculateRunning} />
        <ExportDataSection orgSlug={orgSlug} />
        <JobHistory
          runs={runs}
          page={page}
          hasMore={hasMore}
          isLoading={isLoading}
          onNextPage={nextPage}
          onPrevPage={prevPage}
          onCancel={cancel}
          onRetrigger={retrigger}
          isActing={isActing}
          actionError={actionError}
        />
      </Stack>
    </ContentSection>
  )
}
