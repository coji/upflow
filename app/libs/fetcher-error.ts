/**
 * Check if a fetcher has settled with an error response.
 * Convention: action returns `{ ok: true }` on success; absence of `ok` indicates an error.
 */
export function hasFetcherError(fetcher: {
  state: string
  data: unknown
}): boolean {
  return (
    fetcher.state === 'idle' &&
    fetcher.data != null &&
    !('ok' in (fetcher.data as Record<string, unknown>))
  )
}
