import type { CycleStage } from '../+functions/aggregate'

export const STAGE_LABEL: Record<CycleStage, string> = {
  coding: 'Coding',
  pickup: 'Pickup',
  review: 'Review',
}

/**
 * Stage colors aligned with the existing chart palette. Values reference
 * `--color-chart-*` tokens defined in the Tailwind config.
 */
export const STAGE_COLOR_VAR: Record<CycleStage, string> = {
  coding: 'var(--color-chart-2)',
  pickup: 'var(--color-chart-4)',
  review: 'var(--color-chart-1)',
}

/**
 * Format a duration expressed in days. Sub-day values are reported in hours
 * (or minutes when below 1h) so a 0.16-day median reads as "3.8h" instead of
 * the imprecise "0.2d", and stage cells stay comparable in one breath.
 */
export function formatDuration(value: number): string {
  if (value === 0) return '0d'
  const abs = Math.abs(value)
  if (abs >= 1) return `${value.toFixed(1)}d`
  const hours = value * 24
  if (Math.abs(hours) >= 1) return `${hours.toFixed(1)}h`
  return `${Math.round(value * 24 * 60)}m`
}

export function formatDays(value: number | null): string {
  if (value === null) return '—'
  return formatDuration(value)
}

export function formatSignedDays(value: number | null): string {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatDuration(value)}`
}

export function formatSignedPct(value: number | null): string {
  if (value === null) return ''
  const sign = value >= 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(1)}%`
}
