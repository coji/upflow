import { ChevronRightIcon } from 'lucide-react'
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
import { useTimezone } from '~/app/hooks/use-timezone'
import dayjs from '~/app/libs/dayjs'
import { formatPrIdentifier } from '~/app/libs/format-pr'
import type { LongestPrRow } from '../+functions/aggregate'
import { CompositionBar, compositionFromStageTimes } from './composition-bar'
import { STAGE_COLOR_VAR, STAGE_LABEL, formatDays } from './stage-config'

interface LongestPrsTableProps {
  rows: LongestPrRow[]
}

export function LongestPrsTable({ rows }: LongestPrsTableProps) {
  const timezone = useTimezone()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Longest Cycle Time PRs</CardTitle>
        <CardDescription>
          Released PRs ranked by total time. Click a row to open the pull
          request in a new tab.
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
                  <TableHead>PR</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead className="min-w-[160px]">Composition</TableHead>
                  <TableHead>Bottleneck</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead className="w-8" aria-hidden />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const open = () =>
                    window.open(row.url, '_blank', 'noopener,noreferrer')
                  return (
                    <TableRow
                      key={`${row.repositoryId}:${row.number}`}
                      onClick={open}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          open()
                        }
                      }}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open pull request #${row.number}: ${row.title}`}
                      className="hover:bg-muted/50 focus-visible:bg-muted/50 cursor-pointer focus-visible:outline-none"
                    >
                      <TableCell className="max-w-[320px]">
                        <div className="text-muted-foreground text-xs tabular-nums">
                          {formatPrIdentifier(row.repo, row.number)}
                        </div>
                        <div className="text-primary line-clamp-1">
                          {row.title}
                        </div>
                      </TableCell>
                      <TableCell>
                        <AuthorBadge
                          login={row.author}
                          displayName={row.authorDisplayName}
                        />
                      </TableCell>
                      <TableCell>
                        <CompositionBar
                          composition={compositionFromStageTimes(row)}
                        />
                      </TableCell>
                      <TableCell>
                        {row.bottleneck ? (
                          <Badge
                            variant="outline"
                            className="font-normal"
                            style={{
                              borderColor: STAGE_COLOR_VAR[row.bottleneck],
                              color: STAGE_COLOR_VAR[row.bottleneck],
                            }}
                          >
                            {STAGE_LABEL[row.bottleneck]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {row.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatDays(row.totalTime)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {dayjs.utc(row.updatedAt).tz(timezone).format('MMM D')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <ChevronRightIcon className="size-4" />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
