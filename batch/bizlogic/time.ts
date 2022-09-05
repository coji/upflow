import dayjs from 'dayjs'
import { pipe, filter, sortBy, first } from 'remeda'

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
  firstReviewedAt
}: {
  pullRequestCreatedAt: string
  firstReviewedAt: string | null
}) =>
  pullRequestCreatedAt && firstReviewedAt
    ? Math.abs(dayjs(firstReviewedAt).diff(pullRequestCreatedAt, 'days', true))
    : null

export const reviewTime = ({
  firstCommittedAt,
  pullRequestCreatedAt,
  firstReviewedAt,
  mergedAt
}: {
  firstCommittedAt: string | null
  pullRequestCreatedAt: string | null
  firstReviewedAt: string | null
  mergedAt: string | null
}) => {
  if (!mergedAt) return null
  if (firstReviewedAt) return Math.abs(dayjs(mergedAt).diff(firstReviewedAt, 'days', true))
  if (pullRequestCreatedAt) return Math.abs(dayjs(mergedAt).diff(pullRequestCreatedAt, 'days', true))
  if (firstCommittedAt) return Math.abs(dayjs(mergedAt).diff(firstCommittedAt, 'days', true))
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
  pullRequestCreatedAt: string | null
  firstReviewedAt: string | null
  mergedAt: string | null
  releasedAt: string | null
}) => {
  const firstTime = pipe(
    [firstCommittedAt, pullRequestCreatedAt, firstReviewedAt, mergedAt, releasedAt],
    filter((x) => !!x),
    sortBy((x) => dayjs(x).unix()),
    first()
  )
  const lastTime = pipe(
    [firstCommittedAt, pullRequestCreatedAt, firstReviewedAt, mergedAt, releasedAt],
    filter((x) => !!x),
    sortBy((x) => -dayjs(x).unix()),
    first()
  )
  if (firstTime && lastTime) return dayjs(lastTime).diff(firstTime, 'days', true)
  else return null
}
