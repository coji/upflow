import { firstCommit } from './firstCommit'
import { reviewComments } from './reviewComments'
import { firstReviewComment } from './firstReviewComment'
import { releasedMergeRequests } from './releasedMergeRequests'
import { findReleaseDate } from './findReleaseDate'
import { isCommitIncluded } from './isCommitIncluded'
import { leastUpdatedMergeRequest } from './leastCreatedMergeRequest'

export const createAggregator = () => {
  return {
    firstCommit,
    reviewComments,
    firstReviewComment,
    releasedMergeRequests,
    findReleaseDate,
    isCommitIncluded,
    leastUpdatedMergeRequest
  }
}
