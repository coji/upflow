import type { createFetcher } from './fetcher'
import type { createStore } from './store'

export type PrFetcher = Pick<
  ReturnType<typeof createFetcher>,
  'pullrequest' | 'commits' | 'comments' | 'reviews' | 'timelineItems' | 'files'
>
export type PrStore = Pick<
  ReturnType<typeof createStore>,
  'getFetchedAt' | 'savePrData'
>

/**
 * Reads one PR from GitHub and saves it to githubRawData.
 *
 * Returns false when another fetch of the same PR saved the row while this
 * one was reading: the save is refused (see store.savePrData), and the caller
 * treats it like a failed fetch. Throws when a GitHub read fails.
 */
export const fetchAndSavePr = async (
  fetcher: PrFetcher,
  store: PrStore,
  prNumber: number,
): Promise<boolean> => {
  // Before the first GitHub request: what the save may overwrite.
  const expectedFetchedAt = await store.getFetchedAt(prNumber)
  const [prMetadata, commits, discussions, reviews, timelineItems, files] =
    await Promise.all([
      fetcher.pullrequest(prNumber),
      fetcher.commits(prNumber),
      fetcher.comments(prNumber),
      fetcher.reviews(prNumber),
      fetcher.timelineItems(prNumber),
      fetcher.files(prNumber),
    ])
  return store.savePrData(
    { ...prMetadata, files },
    { commits, reviews, discussions, timelineItems },
    expectedFetchedAt,
  )
}
