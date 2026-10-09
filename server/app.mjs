import { serveStatic } from '@hono/node-server/serve-static'
import { consola } from 'consola'
import { Hono } from 'hono'
import { COMPRESSIBLE_CONTENT_TYPE_REGEX, compress } from 'hono/compress'

const ONE_HOUR = 60 * 60
const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * Server-sent events must reach the client as they are written; gzip would
 * buffer them (durably streams job progress over SSE).
 * @param {string} contentType
 */
const isCompressible = (contentType) =>
  !/^\s*text\/event-stream/i.test(contentType) &&
  COMPRESSIBLE_CONTENT_TYPE_REGEX.test(contentType)

/**
 * serveStatic calls onFound after it has built the response, so a header set
 * there would be lost. Mark the context instead and add headers after next().
 * @param {string} _path
 * @param {import('hono').Context} c
 */
const markStaticFile = (_path, c) => {
  c.set('staticFile', true)
}

/**
 * @param {object} options
 * @param {(request: Request) => Promise<Response>} options.handler React Router request handler
 * @param {string} [options.publicDir]
 * @param {string} [options.clientDir] React Router client build output
 */
export function createApp({
  handler,
  publicDir = './public',
  clientDir = './build/client',
}) {
  const app = new Hono()

  // Access log in morgan's "tiny" format
  app.use(async (c, next) => {
    const start = performance.now()
    await next()
    const { pathname, search } = new URL(c.req.url)
    if (pathname === '/healthcheck') return
    const length = c.res.headers.get('content-length') ?? '-'
    const elapsed = (performance.now() - start).toFixed(3)
    console.log(
      `${c.req.method} ${pathname}${search} ${c.res.status} ${length} - ${elapsed} ms`,
    )
  })

  // Headers go on after next(): a header set beforehand is dropped when the
  // handler returns its own Response. Once the response is final, c.header()
  // clones it, so this also works for immutable responses.
  app.use(async (c, next) => {
    await next()
    c.header('x-fly-region', process.env.FLY_REGION ?? 'unknown')
    c.header('Strict-Transport-Security', `max-age=${ONE_YEAR * 100}`)
    if (c.get('staticFile')) {
      // Build-hashed files under /assets never change; everything else may.
      c.header(
        'Cache-Control',
        c.req.path.startsWith('/assets/')
          ? `public, max-age=${ONE_YEAR}, immutable`
          : `public, max-age=${ONE_HOUR}`,
      )
    }
  })

  // /clean-urls/ -> /clean-urls
  app.use(async (c, next) => {
    const { pathname, search } = new URL(c.req.url)
    if (pathname.endsWith('/') && pathname.length > 1) {
      return c.redirect(
        pathname.slice(0, -1).replace(/\/+/g, '/') + search,
        301,
      )
    }
    await next()
  })

  app.use(compress({ contentTypeFilter: isCompressible }))

  // GET only (HEAD is routed here too): serveStatic does not check the method,
  // so mounting it with app.use would answer a POST with the file.
  app.get('*', serveStatic({ root: publicDir, onFound: markStaticFile }))
  app.get('*', serveStatic({ root: clientDir, onFound: markStaticFile }))

  app.all('*', (c) => handler(c.req.raw))

  app.onError((error, c) => {
    consola.error(error)
    return c.text('Internal Server Error', 500)
  })

  return app
}
