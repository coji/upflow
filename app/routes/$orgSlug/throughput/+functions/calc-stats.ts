import { median } from '~/app/libs/stats'

export function calcStats<T extends { achievement: boolean }>(
  prs: T[],
  getTime: (pr: T) => number | null,
) {
  const achievementCount = prs.filter((pr) => pr.achievement).length
  const achievementRate =
    prs.length > 0 ? (achievementCount / prs.length) * 100 : 0
  const times = prs.map(getTime).filter((v): v is number => v !== null)
  return {
    count: prs.length,
    achievementRate,
    median: median(times),
  }
}
