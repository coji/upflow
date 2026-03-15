import { useState } from 'react'
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
import { getPRComplexity } from '~/app/libs/pr-classify'
import type { WipAggregation, WipRawRow } from '../+functions/aggregate'
import { PRDrillDownSheet } from './pr-drill-down-sheet'

type WipLabeledRow = WipRawRow & { wipLabel: string }

const chartConfig = {
  medianHours: {
    label: 'Median Review Time (h)',
    color: 'var(--color-chart-1)',
  },
} satisfies ChartConfig

function formatHours(h: number): string {
  if (h < 1) return `${(h * 60).toFixed(0)}m`
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

function getBarColor(label: string): string {
  if (label === 'WIP 0-1') return 'var(--color-chart-2)'
  if (label === 'WIP 2') return 'var(--color-chart-1)'
  if (label === 'WIP 3') return 'var(--color-chart-4)'
  return 'var(--color-destructive)'
}

export function WipCycleChart({
  data,
  rawData,
}: {
  data: WipAggregation
  rawData: WipLabeledRow[]
}) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
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

  const selectedPRs = selectedLabel
    ? rawData
        .filter((pr) => pr.wipLabel === selectedLabel)
        .map((pr) => ({
          number: pr.number,
          title: pr.title,
          url: pr.url,
          repo: pr.repo,
          author: pr.author,
          authorDisplayName: pr.authorDisplayName,
          reviewTime: pr.reviewTime,
          size: getPRComplexity(pr),
          complexityReason: pr.complexityReason,
          riskAreas: pr.riskAreas,
        }))
    : []

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
                <Cell
                  key={entry.label}
                  fill={getBarColor(entry.label)}
                  className="cursor-pointer"
                  onClick={() => setSelectedLabel(entry.label)}
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

      <PRDrillDownSheet
        open={selectedLabel !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedLabel(null)
        }}
        title={`${selectedLabel} PRs`}
        description={`${selectedPRs.length} pull requests with ${selectedLabel} concurrent open PRs`}
        prs={selectedPRs}
      />
    </Card>
  )
}
