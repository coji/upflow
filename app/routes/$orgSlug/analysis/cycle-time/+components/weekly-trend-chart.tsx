import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/app/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '~/app/components/ui/chart'
import type { MetricMode, WeeklyTrendPoint } from '../+functions/aggregate'
import { STAGE_COLOR_VAR, STAGE_LABEL, formatDays } from './stage-config'

const chartConfig = {
  coding: { label: STAGE_LABEL.coding, color: STAGE_COLOR_VAR.coding },
  pickup: { label: STAGE_LABEL.pickup, color: STAGE_COLOR_VAR.pickup },
  review: { label: STAGE_LABEL.review, color: STAGE_COLOR_VAR.review },
  prCount: { label: 'PRs merged', color: 'var(--color-foreground)' },
} satisfies ChartConfig

const STAGES = ['coding', 'pickup', 'review'] as const

interface WeeklyTrendChartProps {
  weeks: WeeklyTrendPoint[]
  mode: MetricMode
  selectedWeek: string | null
  onSelectWeek: (weekStart: string | null) => void
}

export function WeeklyTrendChart({
  weeks,
  mode,
  selectedWeek,
  onSelectWeek,
}: WeeklyTrendChartProps) {
  const titleSuffix = mode === 'median' ? 'median' : 'average'

  if (weeks.length === 0 || weeks.every((w) => w.prCount === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Cycle Time Trend</CardTitle>
          <CardDescription>
            No merged pull requests in this period.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handleChartClick = (state: {
    activePayload?: { payload?: unknown }[]
  }) => {
    const payload = state?.activePayload?.[0]?.payload as
      | WeeklyTrendPoint
      | undefined
    if (!payload) return
    onSelectWeek(payload.weekStart === selectedWeek ? null : payload.weekStart)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Cycle Time Trend</CardTitle>
        <CardDescription>
          Stacked stage breakdown ({titleSuffix} days). The line shows weekly
          merged PR count (right axis). Click a week to drill down.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          style={{ height: 320, width: '100%' }}
        >
          <ComposedChart
            data={weeks}
            onClick={handleChartClick}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 12 }}
              minTickGap={16}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(v: number) => `${v.toFixed(0)}d`}
              width={40}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              allowDecimals={false}
              tickFormatter={(v: number) => `${v}`}
              width={32}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    if (!payload?.length) return ''
                    const p = payload[0]?.payload as
                      | WeeklyTrendPoint
                      | undefined
                    if (!p) return ''
                    return `${p.weekLabel} · ${p.prCount} PR${p.prCount === 1 ? '' : 's'}`
                  }}
                  formatter={(value, name) => {
                    const numeric =
                      typeof value === 'number' ? value : Number(value)
                    const label =
                      typeof name === 'string'
                        ? (chartConfig[name as keyof typeof chartConfig]
                            ?.label ?? name)
                        : name
                    const formatted = !Number.isFinite(numeric)
                      ? '—'
                      : name === 'prCount'
                        ? `${numeric}`
                        : formatDays(numeric)
                    return (
                      <div className="flex flex-1 justify-between gap-4">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono tabular-nums">
                          {formatted}
                        </span>
                      </div>
                    )
                  }}
                />
              }
            />
            <ChartLegend
              content={<ChartLegendContent className="flex-wrap" />}
            />
            {STAGES.map((stage, i) => (
              <Bar
                key={stage}
                yAxisId="left"
                dataKey={stage}
                stackId="cycle"
                fill={`var(--color-${stage})`}
                radius={
                  i === STAGES.length - 1
                    ? ([4, 4, 0, 0] as [number, number, number, number])
                    : undefined
                }
              >
                {weeks.map((w) => (
                  <Cell
                    key={w.weekStart}
                    fillOpacity={
                      selectedWeek === null || selectedWeek === w.weekStart
                        ? 1
                        : 0.3
                    }
                  />
                ))}
              </Bar>
            ))}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="prCount"
              stroke="var(--color-prCount)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
