import dayjs from 'dayjs'
import { pipe, filter, sortBy, first, last } from 'remeda'

export const codingTime = ({
  firstCommittedAt,
  pullRequestCreatedAt
}: {
  firstCommittedAt: string | null
  pullRequestCreatedAt: string | null
}) =>
  firstCommittedAt && pullRequestCreatedAt
    ? Math.abs(dayjs(pullRequestCreatedAt).diff(firstCommittedAt, 'days', true))
    : null

export const pickupTime = ({
  pullRequestCreatedAt,
  firstReviewedAt,
  mergedAt
}: {
  pullRequestCreatedAt: string
  firstReviewedAt: string | null
  mergedAt: string | null
}) => {
  if (firstReviewedAt) return Math.abs(dayjs(firstReviewedAt).diff(pullRequestCreatedAt, 'days', true))
  if (mergedAt) Math.abs(dayjs(firstReviewedAt).diff(mergedAt, 'days', true))
  return null
}

export const reviewTime = ({
  firstReviewedAt,
  mergedAt
}: {
  firstReviewedAt: string | null
  mergedAt: string | null
}) => {
  if (!mergedAt) return null
  if (firstReviewedAt) return Math.abs(dayjs(mergedAt).diff(firstReviewedAt, 'days', true))
  return null
}

export const deployTime = ({ mergedAt, releasedAt }: { mergedAt: string | null; releasedAt: string | null }) => {
  if (!mergedAt) return null
  if (!releasedAt) return null
  return Math.abs(dayjs(releasedAt).diff(mergedAt, 'days', true))
}

export const totalTime = ({
  firstCommittedAt,
  pullRequestCreatedAt,
  firstReviewedAt,
  mergedAt,
  releasedAt
}: {
  firstCommittedAt: string | null
  pullRequestCreatedAt: string
  firstReviewedAt: string | null
  mergedAt: string | null
  releasedAt: string | null
}) => {
  const times = pipe(
    [firstCommittedAt, pullRequestCreatedAt, firstReviewedAt, mergedAt, releasedAt],
    filter((x) => !!x),
    sortBy((x) => dayjs(x).unix())
  )
  const firstTime = first(times)
  const lastTime = last(times)
  if (firstTime && lastTime) return dayjs(lastTime).diff(firstTime, 'days', true)
  else return null
}
