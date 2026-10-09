import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Structural test: server.mjs must rebuild the request URL from the Fly
// proxy's X-Forwarded-Proto. React Router v8 rejects document POSTs whose
// Origin header doesn't match the server-side request URL ("Bad Request").
// Fly terminates TLS and forwards plain HTTP, so without this every browser
// form submission (login included) fails behind the proxy while header-less
// clients like curl keep working. The URL logic itself is unit-tested in
// server/forwarded-url.test.ts.

const ROOT = path.resolve(__dirname, '../..')

describe('forwarded proto', () => {
  it('server.mjs rewrites req.url with resolveForwardedUrl before Hono sees it', () => {
    const source = readFileSync(path.join(ROOT, 'server.mjs'), 'utf-8')
    expect(source).toMatch(
      /const (\w+) = resolveForwardedUrl\(req\.url, req\.headers\)\s*\n\s*if \(\1\) req\.url = \1\s*\n\s*listener\(req, res\)/,
    )
  })
})
