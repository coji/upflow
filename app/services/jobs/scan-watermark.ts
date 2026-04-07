/**
 * Compute the next scan watermark for a repository after a crawl sweep.
 *
 * Background (#278): the scan watermark is the PR `updatedAt` upper bound up
 * to which a full-sweep crawl has guaranteed every PR has been fetched. The
 * next full crawl uses it as `stopBefore` for paginating the PR list. Getting
 * this wrong silently drops PRs forever, so the invariants matter:
 *
 * 1. Targeted (webhook) fetches MUST NOT advance the watermark. They only see
 *    a specific PR number list, so advancing the watermark past skipped PRs
 *    would cause the next full sweep to stop short of them.
 * 2. Partially-failed sweeps MUST NOT advance the watermark. If any listed PR
 *    failed to save, the next sweep needs to see it again, which requires
 *    keeping the watermark at (or below) the failed PR's updatedAt.
 * 3. Sweeps that saw zero new PRs leave the watermark as-is (returning null
 *    from this function means "do not update").
 *
 * Returns the new watermark timestamp, or null to signal no update.
 */
export const computeAdvancedScanWatermark = (params: {
  isTargetedFetch: boolean
  prsToFetch: ReadonlyArray<{ number: number; updatedAt?: string }>
  savedPrNumbers: ReadonlySet<number>
}): string | null => {
  const { isTargetedFetch, prsToFetch, savedPrNumbers } = params

  if (isTargetedFetch) return null
  if (prsToFetch.length === 0) return null
  if (savedPrNumbers.size !== prsToFetch.length) return null

  let max: string | null = null
  for (const pr of prsToFetch) {
    if (!pr.updatedAt) continue
    if (max === null || pr.updatedAt > max) max = pr.updatedAt
  }
  return max
}
