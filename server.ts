import { createRequestHandler, logDevReady, type ServerBuild } from '@remix-run/server-runtime'
import { type Serve } from 'bun'
import { resolve } from 'node:path'
import { createJobSchedular } from './batch/job-schedular'

const buildIndex = './build/index'
const build = await import(buildIndex)
if (Bun.env.NODE_ENV === 'development') logDevReady(build as unknown as ServerBuild)

export default {
  port: Bun.env.PORT || 3000,
  async fetch(request) {
    const { pathname } = new URL(request.url)
    const file = Bun.file(resolve(__dirname, './public/', `.${pathname}`))
    if (await file.exists()) return new Response(file)
    return createRequestHandler(build as unknown as ServerBuild, 'development')(request)
  },
} satisfies Serve

const { startSchedular } = createJobSchedular()
startSchedular()
