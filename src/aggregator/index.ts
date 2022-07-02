import { firstCommit } from './firstCommit'
import { reviewComments } from './reviewCommits'
import { firstReviewComment } from './firstReviewComment'
import { releasedMergeRequests } from './releasedMergeRequests'
import { findReleaseDate } from './findReleaseDate'
import { isCommitIncluded } from './isCommitIncluded'

export const createAggregator = () => {
  return {
    firstCommit,
    reviewComments,
    firstReviewComment,
    releasedMergeRequests,
    findReleaseDate,
    isCommitIncluded
  }
}
