import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/app/components/ui/card'
import type { BottleneckMix, MetricMode } from '../+functions/aggregate'
import { STAGE_COLOR_VAR, STAGE_LABEL, formatDays } from './stage-config'

interface BottleneckMixCardProps {
  mix: BottleneckMix
  mode: MetricMode
}

export function BottleneckMixCard({ mix, mode }: BottleneckMixCardProps) {
  const hasData = mix.sum > 0
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bottleneck Mix</CardTitle>
        <CardDescription>
          Stage share by {mode} time across released PRs in this period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <>
            <div
              className="flex h-7 w-full overflow-hidden rounded"
              role="img"
              aria-label="Cycle time stage composition"
            >
              {mix.slices.map((s) => (
                <div
                  key={s.stage}
                  className="h-full flex-shrink-0"
                  style={{
                    width: `${(s.ratio * 100).toFixed(2)}%`,
                    backgroundColor: STAGE_COLOR_VAR[s.stage],
                  }}
                  title={`${STAGE_LABEL[s.stage]} ${(s.ratio * 100).toFixed(0)}%`}
                />
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {mix.slices.map((s) => (
                <li key={s.stage} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-1 inline-block size-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: STAGE_COLOR_VAR[s.stage] }}
                  />
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium">
                      {(s.ratio * 100).toFixed(0)}%
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {STAGE_LABEL[s.stage]} · {formatDays(s.value)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Not enough data to compute stage composition.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
