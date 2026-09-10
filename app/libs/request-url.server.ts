/**
 * Normalized URL for a loader/action request.
 *
 * React Router v8 passes the raw request through to loaders/actions, so on
 * client-side navigations `request.url` carries framework internals (`.data`
 * suffix, `_routes` params). Route code should use the loader/action `url`
 * arg instead; this helper is for Request-based helpers (e.g.
 * `loginRedirect`) that don't receive loader args.
 */
export const requestUrl = (request: Request): URL => {
  const url = new URL(request.url)
  if (url.pathname.endsWith('.data')) {
    url.pathname = url.pathname.slice(0, -'.data'.length)
  }
  url.searchParams.delete('_routes')
  return url
}
