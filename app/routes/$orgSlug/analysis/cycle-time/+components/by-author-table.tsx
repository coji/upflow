import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from 'lucide-react'
import { AuthorBadge } from '~/app/components/author-badge'
import { Badge } from '~/app/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/app/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui/table'
import { cn } from '~/app/libs/utils'
import type {
  AuthorRow,
  CycleTimeDelta,
  MetricMode,
} from '../+functions/aggregate'
import {
  STAGE_COLOR_VAR,
  STAGE_LABEL,
  formatDays,
  formatSignedDays,
  formatSignedPct,
} from './stage-config'

interface ByAuthorTableProps {
  rows: AuthorRow[]
  mode: MetricMode
}

export function ByAuthorTable({ rows, mode }: ByAuthorTableProps) {
  const totalLabel = mode === 'median' ? 'Median Total' : 'Avg Total'
  return (
    <Card>
      <CardHeader>
        <CardTitle>By Author</CardTitle>
        <CardDescription>
          Cycle time per author so you can spot who and which stage to follow up
          with. Sorted by PR count.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No released pull requests in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Author</TableHead>
                  <TableHead className="text-right">PRs</TableHead>
                  <TableHead className="min-w-[160px]">Composition</TableHead>
                  <TableHead className="text-right">{totalLabel}</TableHead>
                  <TableHead>Main driver</TableHead>
                  <TableHead className="text-right">Review p75</TableHead>
                  <TableHead className="text-right">vs prev</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.author}>
                    <TableCell className="font-medium">
                      <AuthorBadge
                        login={row.author}
                        displayName={row.displayName}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.prCount}
                    </TableCell>
                    <TableCell>
                      <CompositionBar composition={row.composition} />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatDays(row.total)}
                    </TableCell>
                    <TableCell>
                      <MainDriverPill driver={row.mainDriver} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDays(row.reviewP75)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeltaText delta={row.changeVsPrev} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CompositionBar({
  composition,
}: {
  composition: AuthorRow['composition']
}) {
  const hasAny = composition.some((c) => c.ratio > 0)
  if (!hasAny) {
    return <div className="bg-muted h-2 w-full rounded" aria-hidden />
  }
  return (
    <div
      className="bg-muted/40 flex h-2 w-full overflow-hidden rounded"
      role="img"
      aria-label="Stage composition"
    >
      {composition.map((c) => (
        <div
          key={c.stage}
          className="h-full"
          style={{
            width: `${(c.ratio * 100).toFixed(2)}%`,
            backgroundColor: STAGE_COLOR_VAR[c.stage],
            opacity: 0.7,
          }}
          title={`${STAGE_LABEL[c.stage]} ${(c.ratio * 100).toFixed(0)}%`}
        />
      ))}
    </div>
  )
}

function MainDriverPill({ driver }: { driver: AuthorRow['mainDriver'] }) {
  if (driver === null) {
    return <span className="text-muted-foreground text-sm">—</span>
  }
  return (
    <Badge
      variant="outline"
      className="font-normal"
      style={{
        borderColor: STAGE_COLOR_VAR[driver],
        color: STAGE_COLOR_VAR[driver],
      }}
    >
      {STAGE_LABEL[driver]}
    </Badge>
  )
}

function DeltaText({ delta }: { delta: CycleTimeDelta }) {
  if (delta.diff === null) {
    return <span className="text-muted-foreground text-sm">—</span>
  }
  const sign = delta.diff > 0 ? 'up' : delta.diff < 0 ? 'down' : 'flat'
  const Icon =
    sign === 'up' ? ArrowUpIcon : sign === 'down' ? ArrowDownIcon : MinusIcon
  return (
    <span
      className={cn(
        'inline-flex items-center justify-end gap-1 text-xs font-medium tabular-nums',
        sign === 'up' && 'text-rose-600 dark:text-rose-400',
        sign === 'down' && 'text-emerald-600 dark:text-emerald-400',
        sign === 'flat' && 'text-muted-foreground',
      )}
    >
      <Icon className="size-3" />
      <span>{formatSignedDays(delta.diff)}</span>
      {delta.pct !== null && (
        <span className="text-muted-foreground">
          ({formatSignedPct(delta.pct)})
        </span>
      )}
    </span>
  )
}
