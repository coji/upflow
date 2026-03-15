import {
  ArrowDownIcon,
  ArrowUpIcon,
  GitPullRequestIcon,
  RepeatIcon,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/app/components/ui/card'
import type { FeedbackSummary } from '../+functions/queries.server'

export function FeedbackSummaryCards({
  summary,
}: {
  summary: FeedbackSummary
}) {
  const total = summary.upgrades + summary.downgrades
  const upgradePercent =
    total > 0 ? Math.round((summary.upgrades / total) * 100) : 0
  const downgradePercent = total > 0 ? 100 - upgradePercent : 0

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total</CardTitle>
          <GitPullRequestIcon className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalCount}</div>
          <p className="text-muted-foreground text-xs">feedbacks</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Direction</CardTitle>
          <RepeatIcon className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-2xl font-bold">
            {total > 0 ? (
              <>
                <span className="flex items-center text-amber-600">
                  <ArrowUpIcon className="h-4 w-4" />
                  {upgradePercent}%
                </span>
                <span className="text-muted-foreground text-sm">/</span>
                <span className="flex items-center text-emerald-600">
                  <ArrowDownIcon className="h-4 w-4" />
                  {downgradePercent}%
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">upgrade / downgrade</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.topPattern
              ? `${summary.topPattern.pattern} (${summary.topPattern.count})`
              : '—'}
          </div>
          <p className="text-muted-foreground text-xs">
            most frequent correction
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Repository</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="truncate text-2xl font-bold">
            {summary.topRepositories[0]
              ? `${summary.topRepositories[0].repo} (${summary.topRepositories[0].count})`
              : '—'}
          </div>
          <p className="text-muted-foreground text-xs">most corrections</p>
        </CardContent>
      </Card>
    </div>
  )
}
