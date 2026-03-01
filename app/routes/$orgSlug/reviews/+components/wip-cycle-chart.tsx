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
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/app/components/ui/chart'
import type { WipAggregation } from '../+functions/aggregate'

const chartConfig = {
  medianHours: {
    label: 'Median Review Time (h)',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

function formatHours(h: number): string {
  if (h < 1) return `${(h * 60).toFixed(0)}m`
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

function getBarColor(label: string): string {
  if (label === 'WIP 0-1') return 'hsl(var(--chart-2))'
  if (label === 'WIP 2') return 'hsl(var(--chart-1))'
  if (label === 'WIP 3') return 'hsl(var(--chart-4))'
  return 'hsl(var(--destructive))'
}

export function WipCycleChart({ data }: { data: WipAggregation }) {
  const { groups, insight } = data

  if (groups.length === 0) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>WIP Count vs Review Time</CardTitle>
        <CardDescription>
          Median review time by WIP count (how many other PRs the author had
          open at the time). More WIP tends to mean longer review times.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          style={{ height: 300, width: '100%' }}
        >
          <BarChart data={groups}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={(v: number) => formatHours(v)} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatHours(value as number)}
                />
              }
            />
            <Bar dataKey="medianHours" radius={4}>
              {groups.map((entry) => (
                <Cell key={entry.label} fill={getBarColor(entry.label)} />
              ))}
              <LabelList
                dataKey="medianHours"
                position="top"
                formatter={(v: number) => formatHours(v)}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="text-muted-foreground mt-1 flex justify-around text-xs">
          {groups.map((g) => (
            <span key={g.label}>n={g.count}</span>
          ))}
        </div>
        {insight && (
          <p className="text-muted-foreground mt-2 text-center text-sm">
            {insight}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
