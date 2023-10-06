import { createRequestHandler } from '@remix-run/express'
import compression from 'compression'
import express from 'express'
import morgan from 'morgan'
import path from 'path'
import { createJobSchedular } from './batch/job-schedular'

function purgeRequireCache() {
  for (const key in require.cache) {
    if (key.startsWith(BUILD_DIR)) {
      delete require.cache[key]
    }
  }
}

const MODE = process.env.NODE_ENV
const BUILD_DIR = path.join(process.cwd(), 'build', 'index.js')
const build = await import(BUILD_DIR)

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
app.use('/build', express.static('public/build', { immutable: true, maxAge: '1y' }))
app.use(express.static('public', { maxAge: '1h' }))
app.use(morgan('tiny'))

app.all(
  '*',
  MODE === 'production'
    ? createRequestHandler({ build })
    : (...args) => {
        purgeRequireCache()
        const requestHandler = createRequestHandler({
          build,
          mode: MODE,
        })
        return requestHandler(...args)
      },
)
const port = process.env.PORT || 3000

app.listen(port, async () => {
  console.log(`Express server listening on port ${port}`)
})

if (process.env.NODE_ENV === 'production') {
  const { startSchedular } = createJobSchedular()
  startSchedular()
}
