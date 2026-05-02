import { STAGES, type StageRatio } from '../+functions/aggregate'
import { STAGE_COLOR_VAR, STAGE_LABEL } from './stage-config'

interface CompositionBarProps {
  composition: StageRatio[]
}

/**
 * Thin 4-segment bar showing relative time spent in each cycle-time stage.
 * Used in By Author and Longest PRs tables to give a quiet at-a-glance
 * profile without resorting to a full heatmap.
 */
export function CompositionBar({ composition }: CompositionBarProps) {
  const hasAny = composition.some((c) => c.ratio > 0)
  if (!hasAny) {
    return <div className="bg-muted h-2 w-full rounded" aria-hidden />
  }
  return (
    <div
      className="bg-muted/40 flex h-2 w-full overflow-hidden rounded"
      role="img"
      aria-label="Stage composition"
    >
      {composition.map((c) => (
        <div
          key={c.stage}
          className="h-full"
          style={{
            width: `${(c.ratio * 100).toFixed(2)}%`,
            backgroundColor: STAGE_COLOR_VAR[c.stage],
            opacity: 0.7,
          }}
          title={`${STAGE_LABEL[c.stage]} ${(c.ratio * 100).toFixed(0)}%`}
        />
      ))}
    </div>
  )
}

interface StageTimes {
  codingTime: number | null
  pickupTime: number | null
  reviewTime: number | null
}

const STAGE_TIME_KEY = {
  coding: 'codingTime',
  pickup: 'pickupTime',
  review: 'reviewTime',
} as const satisfies Record<StageRatio['stage'], keyof StageTimes>

/**
 * Compute per-PR stage composition ratios from a row's raw stage times.
 * Null stages count as zero; when all stages are null/zero, every ratio is 0.
 */
export function compositionFromStageTimes(times: StageTimes): StageRatio[] {
  const values = STAGES.map((stage) => times[STAGE_TIME_KEY[stage]] ?? 0)
  const sum = values.reduce((s, v) => s + v, 0)
  return STAGES.map((stage, i) => ({
    stage,
    ratio: sum > 0 ? values[i] / sum : 0,
  }))
}
