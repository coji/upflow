/**
 * Fly terminates TLS at the edge and forwards plain HTTP, so the Node socket
 * never sees https and @hono/node-server builds every request URL as http.
 * React Router v8's same-origin action check then compares the browser Origin
 * (https) against an http URL and rejects every document POST with 400.
 *
 * Returns the absolute public URL when the proxy reports https. Node's
 * `incoming.url` accepts an absolute URL, and @hono/node-server uses it as-is,
 * so body streaming and the abort signal stay untouched. X-Forwarded-Host is
 * deliberately ignored: Fly keeps the original Host header.
 *
 * @param {string | undefined} url `incoming.url` (path + query)
 * @param {import('node:http').IncomingHttpHeaders} headers
 * @returns {string | null} absolute URL, or null to keep the default
 */
export function resolveForwardedUrl(url, headers) {
  const host = headers.host
  if (
    headers['x-forwarded-proto'] !== 'https' ||
    !host ||
    !url?.startsWith('/')
  ) {
    return null
  }
  return `https://${host}${url}`
}
