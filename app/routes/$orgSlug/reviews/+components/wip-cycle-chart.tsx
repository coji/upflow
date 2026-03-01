import { useMemo } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Scatter,
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
  ChartTooltip,
} from '~/app/components/ui/chart'
import type { getWipCycleCorrelation } from '../+functions/queries.server'

type WipData = Awaited<ReturnType<typeof getWipCycleCorrelation>>

const chartConfig = {
  reviewTime: {
    label: 'Review Time (hours)',
    color: 'hsl(var(--chart-1))',
  },
  median: {
    label: 'Median',
    color: 'hsl(var(--chart-5))',
  },
} satisfies ChartConfig

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function formatHours(h: number): string {
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

export function WipCycleChart({ data }: { data: WipData }) {
  const { scatterData, medianLineData, insight } = useMemo(() => {
    const scatter = data
      .filter(
        (d): d is typeof d & { reviewTime: number } =>
          d.reviewTime !== null && d.reviewTime > 0,
      )
      .map((d) => ({
        wipCount: d.wipCount,
        reviewTime: d.reviewTime * 24, // days to hours
        author: d.authorDisplayName || d.author,
        title: d.title,
      }))

    // WIP別の中央値を計算
    const byWip: Record<number, number[]> = {}
    for (const d of scatter) {
      const wip = d.wipCount
      if (!byWip[wip]) byWip[wip] = []
      byWip[wip].push(d.reviewTime)
    }

    const medianLine = Object.entries(byWip)
      .map(([wip, times]) => ({
        wipCount: Number(wip),
        median: median(times),
      }))
      .filter((d) => d.median !== null)
      .sort((a, b) => a.wipCount - b.wipCount)

    // WIP=0-1 vs WIP=3+ の比較
    const lowWipTimes = scatter
      .filter((d) => d.wipCount <= 1)
      .map((d) => d.reviewTime)
    const highWipTimes = scatter
      .filter((d) => d.wipCount >= 3)
      .map((d) => d.reviewTime)

    const lowMedian = median(lowWipTimes)
    const highMedian = median(highWipTimes)

    let insightText: string | null = null
    if (lowMedian && highMedian && lowMedian > 0) {
      const ratio = (highMedian / lowMedian).toFixed(1)
      insightText = `WIP 0-1 の review time 中央値: ${formatHours(lowMedian)} → WIP 3+ : ${formatHours(highMedian)}（${ratio}倍）`
    }

    return {
      scatterData: scatter,
      medianLineData: medianLine,
      insight: insightText,
    }
  }, [data])

  if (scatterData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>WIP Count vs Review Time</CardTitle>
          <CardDescription>
            No data available for the selected period.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const maxWip = Math.max(...scatterData.map((d) => d.wipCount))
  const maxReviewTime = Math.min(
    Math.max(...scatterData.map((d) => d.reviewTime)),
    500,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>WIP Count vs Review Time</CardTitle>
        <CardDescription>
          Each dot is a merged PR. X-axis = how many other PRs the author had
          open at the time. More WIP tends to mean longer review times.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          style={{ height: 350, width: '100%' }}
        >
          <ComposedChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="wipCount"
              type="number"
              domain={[0, maxWip + 1]}
              allowDecimals={false}
              label={{
                value: 'WIP count at PR creation',
                position: 'bottom',
                offset: 0,
              }}
            />
            <YAxis
              dataKey="reviewTime"
              type="number"
              domain={[0, maxReviewTime]}
              label={{
                value: 'Review time (hours)',
                angle: -90,
                position: 'insideLeft',
              }}
            />
            <ChartTooltip
              content={({ payload }) => {
                if (!payload?.length) return null
                const d = payload[0]?.payload
                if (!d) return null
                return (
                  <div className="bg-background rounded-lg border p-2 text-xs shadow-sm">
                    <p className="font-medium">{d.title || d.author}</p>
                    <p className="text-muted-foreground">
                      WIP: {d.wipCount} | Review: {formatHours(d.reviewTime)}
                    </p>
                    {d.author && (
                      <p className="text-muted-foreground">by {d.author}</p>
                    )}
                  </div>
                )
              }}
            />
            <Scatter
              data={scatterData}
              fill="hsl(var(--chart-1))"
              fillOpacity={0.4}
              r={4}
            />
            <Line
              data={medianLineData}
              dataKey="median"
              stroke="hsl(var(--chart-5))"
              strokeWidth={2.5}
              dot={{ r: 4, fill: 'hsl(var(--chart-5))' }}
              name="Median"
              connectNulls
            />
            <ReferenceLine
              x={3}
              stroke="hsl(var(--destructive))"
              strokeDasharray="3 3"
              label={{
                value: 'WIP=3',
                position: 'top',
                fill: 'hsl(var(--destructive))',
              }}
            />
          </ComposedChart>
        </ChartContainer>
        {insight && (
          <p className="text-muted-foreground mt-2 text-center text-sm">
            {insight}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
