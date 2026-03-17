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
import { orgContext } from '~/app/middleware/context'
import { durably } from '~/app/services/durably'
import { durably as serverDurably } from '~/app/services/durably.server'
import type { JobSteps } from '~/app/services/jobs/shared-steps.server'
import ContentSection from '../+components/content-section'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Data Management',
    to: href('/:orgSlug/settings/data-management', { orgSlug: params.orgSlug }),
  }),
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization: org } = context.get(orgContext)
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  return match(intent)
    .with('refresh', async () => {
      const run = await serverDurably.jobs.crawl.trigger(
        { organizationId: org.id, refresh: true },
        {
          concurrencyKey: `crawl:${org.id}`,
          labels: { organizationId: org.id },
        },
      )

      return data({ intent: 'refresh' as const, ok: true, runId: run.id })
    })
    .with('recalculate', async () => {
      const selectedSteps = formData.getAll('steps').map(String)
      const steps = {
        upsert: selectedSteps.includes('upsert'),
        classify: selectedSteps.includes('classify'),
        export: selectedSteps.includes('export'),
      } satisfies JobSteps

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

// --- Shared Run Status Alerts ---

function RunStatusAlerts({
  label,
  progress,
  output,
  runError,
  isRunning,
  isCompleted,
  isFailed,
}: {
  label: string
  progress: { message?: string; current?: number; total?: number } | null
  output: { pullCount?: number } | null
  runError: string | null
  isRunning: boolean
  isCompleted: boolean
  isFailed: boolean
}) {
  if (isRunning && progress) {
    return (
      <Alert>
        <AlertDescription>
          <div className="space-y-2">
            <p className="text-sm">{progress.message ?? 'Processing...'}</p>
            {progress.current != null &&
              progress.total != null &&
              progress.total > 0 && (
                <Progress
                  value={(progress.current / progress.total) * 100}
                  className="h-2"
                />
              )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (isRunning) {
    return (
      <Alert>
        <AlertDescription>Starting {label}...</AlertDescription>
      </Alert>
    )
  }

  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1)

  if (isCompleted) {
    return (
      <Alert>
        <AlertDescription>
          {capitalizedLabel} completed.{' '}
          {output?.pullCount != null && `${output.pullCount} PRs updated.`}
        </AlertDescription>
      </Alert>
    )
  }

  if (isFailed) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {capitalizedLabel} failed. {runError}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

// --- Refresh Section ---

function RefreshSection() {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== 'idle'

  const runId =
    fetcher.data?.intent === 'refresh' && fetcher.data?.ok
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
  } = durably.crawl.useRun(runId)

  const isRunning = isPending || isLeased

  return (
    <Stack>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            Full Refresh
            {isRunning && <Badge variant="secondary">Running</Badge>}
          </p>
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

      <RunStatusAlerts
        label="full refresh"
        progress={progress}
        output={output}
        runError={runError}
        isRunning={isRunning}
        isCompleted={isCompleted}
        isFailed={isFailed}
      />
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

      <RunStatusAlerts
        label="recalculation"
        progress={progress}
        output={output}
        runError={runError}
        isRunning={isRunning}
        isCompleted={isCompleted}
        isFailed={isFailed}
      />

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
  params: { orgSlug },
}: Route.ComponentProps) {
  return (
    <ContentSection
      title="Data Management"
      desc="Manage data refresh and recalculation for this organization."
    >
      <Stack gap="6">
        <RefreshSection />
        <RecalculateSection />
        <ExportDataSection orgSlug={orgSlug} />
      </Stack>
    </ContentSection>
  )
}
