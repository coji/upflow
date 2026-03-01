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
import type {
  getReviewerQueueDistribution,
  getReviewerQueuePRs,
} from '../+functions/queries.server'
import { PRDrillDownSheet } from './pr-drill-down-sheet'

type QueueData = Awaited<ReturnType<typeof getReviewerQueueDistribution>>
type QueuePRs = Awaited<ReturnType<typeof getReviewerQueuePRs>>

const chartConfig = {
  queueCount: {
    label: 'Pending Reviews',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

function getBarColor(count: number): string {
  if (count >= 5) return 'hsl(var(--destructive))'
  if (count >= 3) return 'hsl(var(--chart-4))'
  return 'hsl(var(--chart-2))'
}

export function ReviewerQueueChart({
  data,
  rawPRs,
}: {
  data: QueueData
  rawPRs: QueuePRs
}) {
  const [selectedReviewer, setSelectedReviewer] = useState<string | null>(null)

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Queue by Reviewer</CardTitle>
          <CardDescription>
            No pending review requests for open PRs.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const chartData = data.map((d) => ({
    reviewerLogin: d.reviewer,
    reviewer: d.displayName || d.reviewer,
    queueCount: d.queueCount,
  }))

  const chartHeight = Math.max(200, chartData.length * 40 + 60)

  const selectedPRs = selectedReviewer
    ? rawPRs
        .filter((pr) => pr.reviewer === selectedReviewer)
        .map((pr) => ({
          number: pr.number,
          title: pr.title,
          url: pr.url,
          repo: pr.repo,
          author: pr.author,
        }))
    : []

  const selectedDisplayName =
    chartData.find((d) => d.reviewerLogin === selectedReviewer)?.reviewer ??
    selectedReviewer

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Queue by Reviewer</CardTitle>
        <CardDescription>
          Number of open PRs waiting for each reviewer. Imbalance here means
          some people are bottlenecks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          style={{ height: chartHeight, width: '100%' }}
        >
          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis
              dataKey="reviewer"
              type="category"
              width={120}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="queueCount" radius={4}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.reviewerLogin}
                  fill={getBarColor(entry.queueCount)}
                  className="cursor-pointer"
                  onClick={() => setSelectedReviewer(entry.reviewerLogin)}
                />
              ))}
              <LabelList dataKey="queueCount" position="right" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>

      <PRDrillDownSheet
        open={selectedReviewer !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedReviewer(null)
        }}
        title={`PRs waiting for ${selectedDisplayName}`}
        prs={selectedPRs}
      />
    </Card>
  )
}
