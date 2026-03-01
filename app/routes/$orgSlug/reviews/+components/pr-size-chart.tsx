import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '~/app/components/ui/chart'
import { getPRComplexity, type PRSizeLabel } from '../+functions/classify'
import type { getPRSizeDistribution } from '../+functions/queries.server'

type SizeData = Awaited<ReturnType<typeof getPRSizeDistribution>>

const SIZE_ORDER: PRSizeLabel[] = ['XS', 'S', 'M', 'L', 'XL']
const SIZE_COLORS: Record<PRSizeLabel, string> = {
  XS: 'hsl(var(--chart-2))',
  S: 'hsl(var(--chart-2))',
  M: 'hsl(var(--chart-1))',
  L: 'hsl(var(--chart-4))',
  XL: 'hsl(var(--destructive))',
}

const countConfig = {
  count: { label: 'PRs', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

const timeConfig = {
  medianHours: {
    label: 'Median Review Time (h)',
    color: 'hsl(var(--chart-3))',
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
  if (h < 1) return `${(h * 60).toFixed(0)}m`
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

export function PRSizeChart({ data }: { data: SizeData }) {
  const { countData, timeData, insight } = useMemo(() => {
    const bySize: Record<
      PRSizeLabel,
      { count: number; reviewTimes: number[] }
    > = {
      XS: { count: 0, reviewTimes: [] },
      S: { count: 0, reviewTimes: [] },
      M: { count: 0, reviewTimes: [] },
      L: { count: 0, reviewTimes: [] },
      XL: { count: 0, reviewTimes: [] },
    }

    for (const pr of data) {
      const size = getPRComplexity(pr)
      bySize[size].count++
      if (pr.reviewTime !== null && pr.reviewTime > 0) {
        bySize[size].reviewTimes.push(pr.reviewTime * 24) // days to hours
      }
    }

    const counts = SIZE_ORDER.map((size) => ({
      size,
      count: bySize[size].count,
    }))

    const times = SIZE_ORDER.map((size) => ({
      size,
      medianHours: median(bySize[size].reviewTimes) ?? 0,
    }))

    const total = data.length
    const xsS = bySize.XS.count + bySize.S.count
    const xsSPct = total > 0 ? ((xsS / total) * 100).toFixed(0) : '0'
    const xsSMedian = median([
      ...bySize.XS.reviewTimes,
      ...bySize.S.reviewTimes,
    ])

    let insightText: string | null = null
    if (total > 0 && xsSMedian !== null) {
      insightText = `全PRの ${xsSPct}% が XS/S サイズ（${xsS}件）。review time 中央値 ${formatHours(xsSMedian)}。これらを自動マージすればレビュー負荷を大幅に削減可能。`
    }

    return { countData: counts, timeData: times, insight: insightText }
  }, [data])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PR Size Distribution</CardTitle>
          <CardDescription>
            No data available for the selected period.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PR Size Distribution & Review Time</CardTitle>
        <CardDescription>
          Small PRs (XS/S) could be auto-merged. Larger PRs take
          disproportionately longer to review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-center text-sm font-medium">
              PR Count by Size
            </p>
            <ChartContainer
              config={countConfig}
              style={{ height: 250, width: '100%' }}
            >
              <BarChart data={countData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="size" />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={4}>
                  {countData.map((entry) => (
                    <Cell key={entry.size} fill={SIZE_COLORS[entry.size]} />
                  ))}
                  <LabelList dataKey="count" position="top" />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>

          <div>
            <p className="mb-2 text-center text-sm font-medium">
              Median Review Time by Size
            </p>
            <ChartContainer
              config={timeConfig}
              style={{ height: 250, width: '100%' }}
            >
              <BarChart data={timeData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="size" />
                <YAxis tickFormatter={(v: number) => formatHours(v)} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatHours(value as number)}
                    />
                  }
                />
                <Bar dataKey="medianHours" radius={4}>
                  {timeData.map((entry) => (
                    <Cell
                      key={entry.size}
                      fill={SIZE_COLORS[entry.size as PRSizeLabel]}
                    />
                  ))}
                  <LabelList
                    dataKey="medianHours"
                    position="top"
                    formatter={(v: number) => formatHours(v)}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        {insight && (
          <p className="text-muted-foreground mt-4 text-center text-sm">
            {insight}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
