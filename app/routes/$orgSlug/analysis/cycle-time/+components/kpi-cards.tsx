import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/app/components/ui/card'
import { cn } from '~/app/libs/utils'
import type {
  CycleTimeDelta,
  CycleTimeKpi,
  MetricMode,
} from '../+functions/aggregate'
import { formatDays, formatSignedDays, formatSignedPct } from './stage-config'

interface KpiCardsProps {
  kpi: CycleTimeKpi
  mode: MetricMode
  periodLabel: string
}

export function KpiCards({ kpi, mode, periodLabel }: KpiCardsProps) {
  const totalLabel = mode === 'median' ? 'Median Total' : 'Avg Total'
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label={totalLabel}
        value={formatDays(kpi.total)}
        delta={kpi.totalDelta}
        deltaInversed
        periodLabel={periodLabel}
      />
      <KpiCard
        label="PRs"
        value={kpi.prCount.toString()}
        delta={kpi.prCountDelta}
        countMode
        periodLabel={periodLabel}
      />
      <KpiCard
        label={mode === 'median' ? 'Review (median)' : 'Review (avg)'}
        value={formatDays(kpi.review)}
        delta={kpi.reviewDelta}
        deltaInversed
        periodLabel={periodLabel}
      />
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: string
  delta: CycleTimeDelta
  /** When true, a decrease is "good" (i.e. cycle time went down). */
  deltaInversed?: boolean
  /** Show count delta in raw integer instead of days. */
  countMode?: boolean
  periodLabel: string
}

function KpiCard({
  label,
  value,
  delta,
  deltaInversed,
  countMode,
  periodLabel,
}: KpiCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground text-xs">
          vs previous {periodLabel}
        </div>
        <DeltaBadge
          delta={delta}
          deltaInversed={deltaInversed}
          countMode={countMode}
        />
      </CardContent>
    </Card>
  )
}

function DeltaBadge({
  delta,
  deltaInversed,
  countMode,
}: {
  delta: CycleTimeDelta
  deltaInversed?: boolean
  countMode?: boolean
}) {
  if (delta.diff === null) {
    return <div className="text-muted-foreground text-sm">—</div>
  }
  const sign = delta.diff > 0 ? 'up' : delta.diff < 0 ? 'down' : 'flat'

  let tone: 'good' | 'bad' | 'neutral' = 'neutral'
  if (!countMode && sign !== 'flat') {
    if (deltaInversed) {
      tone = sign === 'down' ? 'good' : 'bad'
    } else {
      tone = sign === 'up' ? 'good' : 'bad'
    }
  }

  const Icon =
    sign === 'up' ? ArrowUpIcon : sign === 'down' ? ArrowDownIcon : MinusIcon

  const diffText = countMode
    ? `${delta.diff > 0 ? '+' : ''}${delta.diff.toFixed(0)}`
    : formatSignedDays(delta.diff)
  const pctText = formatSignedPct(delta.pct)

  return (
    <div
      className={cn(
        'mt-1 flex items-center gap-1 text-sm font-medium tabular-nums',
        tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
        tone === 'bad' && 'text-rose-600 dark:text-rose-400',
        tone === 'neutral' && 'text-muted-foreground',
      )}
    >
      <Icon className="size-4" />
      <span>{diffText}</span>
      {pctText && <span className="text-muted-foreground">({pctText})</span>}
    </div>
  )
}
