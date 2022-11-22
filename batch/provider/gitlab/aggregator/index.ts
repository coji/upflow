import { firstCommit } from './firstCommit'
import { firstReviewComment } from './firstReviewComment'
import { isCommitIncluded } from './isCommitIncluded'
import { leastUpdatedMergeRequest } from './leastUpdatedMergeRequest'

export const createAggregator = () => {
  return {
    firstCommit,
    firstReviewComment,
    isCommitIncluded,
    leastUpdatedMergeRequest,
  }
}
