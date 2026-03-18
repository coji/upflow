import type { RunStatus, TypedClientRun } from '@coji/durably-react'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Stack,
} from '~/app/components/ui'
import { Progress } from '~/app/components/ui/progress'
import dayjs from '~/app/libs/dayjs'

type Run = TypedClientRun<
  Record<string, unknown>,
  Record<string, unknown> | undefined
>

export function isRunActive(status: RunStatus): boolean {
  return status === 'pending' || status === 'leased'
}

const jobNameColors: Record<string, string> = {
  crawl: 'bg-blue-100 text-blue-800',
  recalculate: 'bg-purple-100 text-purple-800',
  classify: 'bg-amber-100 text-amber-800',
  backfill: 'bg-emerald-100 text-emerald-800',
}

function StatusBadge({ status }: { status: RunStatus }) {
  const variant =
    {
      pending: 'outline' as const,
      leased: 'secondary' as const,
      completed: 'default' as const,
      failed: 'destructive' as const,
      cancelled: 'outline' as const,
    }[status] ?? ('outline' as const)

  return <Badge variant={variant}>{status}</Badge>
}

function RunItem({
  run,
  onCancel,
  onRetrigger,
  isActing,
}: {
  run: Run
  onCancel: (runId: string) => void
  onRetrigger: (runId: string) => void
  isActing: boolean
}) {
  const isRunning = isRunActive(run.status)
  const canRetrigger = run.status === 'failed' || run.status === 'cancelled'

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${jobNameColors[run.jobName] ?? 'bg-gray-100 text-gray-800'}`}
          >
            {run.jobName}
          </span>
          <StatusBadge status={run.status} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {dayjs.utc(run.createdAt).fromNow()}
          </span>
          {isRunning && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onCancel(run.id)}
              disabled={isActing}
            >
              Cancel
            </Button>
          )}
          {canRetrigger && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onRetrigger(run.id)}
              disabled={isActing}
            >
              Retry
            </Button>
          )}
        </div>
      </div>

      {isRunning && run.progress && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">
            {run.progress.message ?? 'Processing...'}
          </p>
          {run.progress.current != null &&
            run.progress.total != null &&
            run.progress.total > 0 && (
              <Progress
                value={(run.progress.current / run.progress.total) * 100}
                className="h-1.5"
              />
            )}
        </div>
      )}

      {run.status === 'completed' && run.output && (
        <p className="text-muted-foreground text-xs">
          {(() => {
            const pullCount = (run.output as { pullCount?: number }).pullCount
            return pullCount != null ? `${pullCount} PRs updated` : 'Done'
          })()}
        </p>
      )}

      {run.status === 'failed' && run.error && (
        <p className="text-xs text-red-600">{run.error}</p>
      )}
    </div>
  )
}

export function JobHistory({
  runs,
  page,
  hasMore,
  isLoading,
  onNextPage,
  onPrevPage,
  onCancel,
  onRetrigger,
  isActing,
  actionError,
}: {
  runs: Run[]
  page: number
  hasMore: boolean
  isLoading: boolean
  onNextPage: () => void
  onPrevPage: () => void
  onCancel: (runId: string) => void
  onRetrigger: (runId: string) => void
  isActing: boolean
  actionError: string | null
}) {
  return (
    <Stack>
      <div className="space-y-1">
        <p className="text-sm font-medium">Job History</p>
        <p className="text-muted-foreground text-xs">
          Recent job executions for this organization.
        </p>
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {isLoading && runs.length === 0 ? (
        <p className="text-muted-foreground text-xs">Loading...</p>
      ) : runs.length === 0 ? (
        <p className="text-muted-foreground text-xs">No job history yet.</p>
      ) : (
        <Stack gap="2">
          {runs.map((run) => (
            <RunItem
              key={run.id}
              run={run}
              onCancel={onCancel}
              onRetrigger={onRetrigger}
              isActing={isActing}
            />
          ))}
        </Stack>
      )}

      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevPage}
            disabled={page === 0}
          >
            Prev
          </Button>
          <span className="text-muted-foreground text-xs">Page {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onNextPage}
            disabled={!hasMore}
          >
            Next
          </Button>
        </div>
      )}
    </Stack>
  )
}
