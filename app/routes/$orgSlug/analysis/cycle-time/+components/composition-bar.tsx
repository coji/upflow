import type { CycleStage } from '../+functions/aggregate'
import { STAGE_COLOR_VAR, STAGE_LABEL } from './stage-config'

interface StageRatio {
  stage: CycleStage
  ratio: number
}

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
  deployTime: number | null
}

/**
 * Compute per-PR stage composition ratios from a row's raw stage times.
 * Null stages count as zero; when all stages are null/zero, every ratio is 0.
 */
export function compositionFromStageTimes(times: StageTimes): StageRatio[] {
  const c = times.codingTime ?? 0
  const p = times.pickupTime ?? 0
  const r = times.reviewTime ?? 0
  const d = times.deployTime ?? 0
  const sum = c + p + r + d
  return [
    { stage: 'coding', ratio: sum > 0 ? c / sum : 0 },
    { stage: 'pickup', ratio: sum > 0 ? p / sum : 0 },
    { stage: 'review', ratio: sum > 0 ? r / sum : 0 },
    { stage: 'deploy', ratio: sum > 0 ? d / sum : 0 },
  ]
}
