import { createServer } from 'node:http'
import { getRequestListener } from '@hono/node-server'
import { consola } from 'consola'
import { createRequestHandler } from 'react-router'
import { createJobScheduler } from './build/job-scheduler.js'
import { createApp } from './server/app.mjs'
import { resolveForwardedUrl } from './server/forwarded-url.mjs'

const build = await import('./build/server/index.js')
const app = createApp({
  handler: createRequestHandler(build, process.env.NODE_ENV),
})
const listener = getRequestListener(app.fetch)

const server = createServer((req, res) => {
  const forwardedUrl = resolveForwardedUrl(req.url, req.headers)
  if (forwardedUrl) req.url = forwardedUrl
  listener(req, res)
})

const port = process.env.PORT || 3000
server.listen(port, () => {
  consola.info(`Hono server listening on port ${port}`)
})

// Graceful shutdown
function shutdown() {
  consola.info('Shutting down...')
  server.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

if (
  process.env.NODE_ENV === 'production' &&
  process.env.DISABLE_JOB_SCHEDULER !== '1'
) {
  const { startScheduler } = createJobScheduler()
  startScheduler()
} else if (process.env.DISABLE_JOB_SCHEDULER === '1') {
  consola.info('job scheduler disabled by DISABLE_JOB_SCHEDULER=1')
}
