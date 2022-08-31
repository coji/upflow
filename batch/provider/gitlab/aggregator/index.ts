import { firstCommit } from './firstCommit'
import { firstReviewComment } from './firstReviewComment'
import { isCommitIncluded } from './isCommitIncluded'
import { leastUpdatedMergeRequest } from './leastUpdatedMergeRequest'
import { reviewComments } from './reviewComments'

export const createAggregator = () => {
  return {
    firstCommit,
    reviewComments,
    firstReviewComment,
    isCommitIncluded,
    leastUpdatedMergeRequest
  }
}
