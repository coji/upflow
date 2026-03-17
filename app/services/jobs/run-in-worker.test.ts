import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { getWorkerRuntime } from './run-in-worker'

describe('getWorkerRuntime', () => {
  test('uses bundled worker files in production', () => {
    const runtime = getWorkerRuntime('analyze-worker', 'production')

    expect(runtime.workerPath).toBe(
      path.resolve(process.cwd(), 'build/workers/analyze-worker.js'),
    )
    expect(runtime.workerOptions.execArgv).toBeUndefined()
  })

  test('uses ts worker files in development', () => {
    const runtime = getWorkerRuntime('upsert-worker', 'development')

    expect(runtime.workerPath).toBe(
      path.resolve(process.cwd(), 'app/services/jobs/upsert-worker.ts'),
    )
    expect(runtime.workerOptions.execArgv).toEqual(['--import', 'tsx'])
  })
})
