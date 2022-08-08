import { firstCommit } from './firstCommit'
import { reviewComments } from './reviewComments'
import { firstReviewComment } from './firstReviewComment'
import { isCommitIncluded } from './isCommitIncluded'
import { leastUpdatedMergeRequest } from './leastCreatedMergeRequest'

export const createAggregator = () => {
  return {
    firstCommit,
    reviewComments,
    firstReviewComment,
    isCommitIncluded,
    leastUpdatedMergeRequest
  }
}
