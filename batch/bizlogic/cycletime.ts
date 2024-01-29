import { filter, first, last, pipe, sortBy } from 'remeda'
import dayjs from '~/app/libs/dayjs'

interface codingTimeProps {
  firstCommittedAt: string | null
  pullRequestCreatedAt: string | null
}
export const codingTime = ({ firstCommittedAt, pullRequestCreatedAt }: codingTimeProps) => {
  if (firstCommittedAt && pullRequestCreatedAt) {
    return Math.abs(dayjs(pullRequestCreatedAt).diff(firstCommittedAt, 'days', true))
  }
  return null
}

interface pickupTimeProps {
  pullRequestCreatedAt: string
  firstReviewedAt: string | null
  mergedAt: string | null
}
export const pickupTime = ({ pullRequestCreatedAt, firstReviewedAt, mergedAt }: pickupTimeProps) => {
  if (firstReviewedAt) {
    return Math.abs(dayjs(firstReviewedAt).diff(pullRequestCreatedAt, 'days', true))
  }
  if (mergedAt) {
    return Math.abs(dayjs(mergedAt).diff(pullRequestCreatedAt, 'days', true))
  }
  return null
}

interface reviewTimeProps {
  firstReviewedAt: string | null
  mergedAt: string | null
}
export const reviewTime = ({ firstReviewedAt, mergedAt }: reviewTimeProps) => {
  if (firstReviewedAt && mergedAt) {
    return Math.abs(dayjs(mergedAt).diff(firstReviewedAt, 'days', true))
  }
  return null
}

interface deployTimeProps {
  mergedAt: string | null
  releasedAt: string | null
}
export const deployTime = ({ mergedAt, releasedAt }: deployTimeProps) => {
  if (mergedAt && releasedAt) {
    return Math.abs(dayjs(releasedAt).diff(mergedAt, 'days', true))
  }
  return null
}

interface totalTimeProps {
  firstCommittedAt: string | null
  pullRequestCreatedAt: string
  firstReviewedAt: string | null
  mergedAt: string | null
  releasedAt: string | null
}
export const totalTime = ({
  firstCommittedAt,
  pullRequestCreatedAt,
  firstReviewedAt,
  mergedAt,
  releasedAt,
}: totalTimeProps) => {
  const times = pipe(
    [firstCommittedAt, pullRequestCreatedAt, firstReviewedAt, mergedAt, releasedAt],
    filter((x) => !!x),
    sortBy((x) => dayjs(x).unix()),
  )
  const firstTime = first(times)
  const lastTime = last(times)
  if (firstTime && lastTime) {
    return dayjs(lastTime).diff(firstTime, 'days', true)
  }
  return null
}
