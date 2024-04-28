import { createRequestHandler } from '@remix-run/express'
import { installGlobals } from '@remix-run/node'
import compression from 'compression'
import express from 'express'
import morgan from 'morgan'
import { createJobSchedular } from './build/job-schedular.js'

installGlobals({ nativeFetch: true })

const viteDevServer =
  process.env.NODE_ENV === 'production'
    ? undefined
    : await import('vite').then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        }),
      )

const app = express()

app.use((req, res, next) => {
  // helpful headers:
  res.set('x-fly-region', process.env.FLY_REGION ?? 'unknown')
  res.set('Strict-Transport-Security', `max-age=${60 * 60 * 24 * 365 * 100}`)
  // /clean-urls/ -> /clean-urls
  if (req.path.endsWith('/') && req.path.length > 1) {
    const query = req.url.slice(req.path.length)
    const safepath = req.path.slice(0, -1).replace(/\/+/g, '/')
    res.redirect(301, safepath + query)
    return
  }
  next()
})

app.use(compression())
app.disable('x-powered-by')
app.use(express.static('public', { maxAge: '1h' }))
app.use(morgan('tiny'))

// handle asset requests
if (viteDevServer) {
  app.use(viteDevServer.middlewares)
} else {
  app.use(
    '/assets',
    express.static('build/client/assets', {
      immutable: true,
      maxAge: '1y',
    }),
  )
}
app.use(express.static('build/client', { maxAge: '1h' }))

// handle SSR requests
app.all(
  '*',
  createRequestHandler({
    build: viteDevServer
      ? () => viteDevServer.ssrLoadModule('virtual:remix/server-build')
      : await import('./build/server/index.js'),
  }),
)

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`Express server listening on port ${port}`)
})

if (process.env.NODE_ENV === 'production') {
  const { startSchedular } = createJobSchedular()
  startSchedular()
}
