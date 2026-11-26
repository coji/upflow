/**
 * How far before the PR list read the watermark must stay. GitHub's
 * `updatedAt` has second resolution, and the second in which the list is read
 * is not finished yet: a PR can still change in that second, after the read,
 * and get the same `updatedAt` as a PR in the list. The margin also covers a
 * server clock that runs ahead of GitHub's, up to this much.
 */
export const SCAN_WATERMARK_CLOCK_MARGIN_MS = 5 * 60 * 1000

/** ISO 8601 UTC in whole seconds, the form GitHub uses for `updatedAt`. */
const toGitHubTimestamp = (ms: number) =>
  new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')

/**
 * Compute the next scan watermark for a repository after a crawl sweep.
 *
 * Background (#278): the scan watermark is the PR `updatedAt` upper bound up
 * to which a full-sweep crawl has guaranteed every PR has been fetched. The
 * next full crawl uses it as `stopBefore` for paginating the PR list, and
 * skips every PR with `updatedAt <= watermark`. Getting this wrong silently
 * drops PRs forever, so the invariants matter:
 *
 * 1. Targeted (webhook) fetches MUST NOT advance the watermark. They only see
 *    a specific PR number list, so advancing the watermark past skipped PRs
 *    would cause the next full sweep to stop short of them.
 * 2. Partially-failed sweeps MUST NOT advance the watermark. If any listed PR
 *    failed to save, the next sweep needs to see it again, which requires
 *    keeping the watermark at (or below) the failed PR's updatedAt.
 * 3. Sweeps that saw zero new PRs leave the watermark as-is (returning null
 *    from this function means "do not update").
 * 4. The watermark never reaches a second that had not ended when the list
 *    was read: it is capped at `listStartedAt` minus
 *    SCAN_WATERMARK_CLOCK_MARGIN_MS. Otherwise a PR updated in that same
 *    second, after the read, has `updatedAt <= watermark` and no later sweep
 *    lists it. The cost is one extra fetch of the PRs updated within the
 *    margin before the read, on the next sweep only.
 *
 * `listStartedAt` is the server time taken just before the PR list request.
 * Without it the function cannot bound the watermark and returns null.
 *
 * Returns the new watermark timestamp, or null to signal no update.
 * Checked by the TLA+ model in verification/crawl-watermark.
 */
export const computeAdvancedScanWatermark = (params: {
  isTargetedFetch: boolean
  prsToFetch: ReadonlyArray<{ number: number; updatedAt?: string }>
  savedPrNumbers: ReadonlySet<number>
  listStartedAt: string | null
}): string | null => {
  const { isTargetedFetch, prsToFetch, savedPrNumbers, listStartedAt } = params

  if (isTargetedFetch) return null
  if (prsToFetch.length === 0) return null
  if (listStartedAt === null) return null

  let max: string | null = null
  for (const pr of prsToFetch) {
    // Membership (not size): guarantees every listed PR was saved, even if
    // savedPrNumbers ever contains unrelated numbers.
    if (!savedPrNumbers.has(pr.number)) return null
    if (!pr.updatedAt) continue
    if (max === null || pr.updatedAt > max) max = pr.updatedAt
  }
  if (max === null) return null

  const cap = toGitHubTimestamp(
    Date.parse(listStartedAt) - SCAN_WATERMARK_CLOCK_MARGIN_MS,
  )
  return max > cap ? cap : max
}
