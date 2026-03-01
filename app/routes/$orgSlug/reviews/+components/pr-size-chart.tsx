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
import type { PRSizeAggregation } from '../+functions/aggregate'
import type { PRSizeLabel } from '../+functions/classify'

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

function formatHours(h: number): string {
  if (h < 1) return `${(h * 60).toFixed(0)}m`
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

export function PRSizeChart({ data }: { data: PRSizeAggregation }) {
  const { countData, timeData, insight } = data

  if (countData.every((d) => d.count === 0)) {
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
