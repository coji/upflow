import path from 'node:path'
import { Worker, type WorkerOptions } from 'node:worker_threads'
import { logger } from '~/batch/helper/logger'

interface AnalyzeWorkerInput {
  organizationId: string
  repositoryId: string
  releaseDetectionMethod: string
  releaseDetectionKey: string
  excludedUsers: string
  filterPrNumbers?: number[]
}

export interface SqliteBusyEvent {
  entrypoint: WorkerEntrypoint
  organizationId: string
  attempt: number
  delayMs: number
  errorMessage: string
  gaveUp: boolean
}

interface RunWorkerOptions {
  onSqliteBusy?: (event: SqliteBusyEvent) => void
}

/**
 * Run PR analysis in a worker thread to keep the main event loop responsive.
 * The worker opens its own SQLite connection and runs buildPullRequests independently.
 */
export function runAnalyzeInWorker<T>(
  input: AnalyzeWorkerInput,
  options?: RunWorkerOptions,
): Promise<T> {
  return runWorker<T>('analyze-worker', input, options)
}
type WorkerEntrypoint = 'analyze-worker'
const SQLITE_BUSY_RETRY_LIMIT = 3
const SQLITE_BUSY_RETRY_DELAYS_MS = [150, 400, 1000]

export function getWorkerRuntime(
  entrypoint: WorkerEntrypoint,
  nodeEnv = process.env.NODE_ENV,
) {
  const isProduction = nodeEnv === 'production'
  const projectRoot = process.cwd()
  const filename = isProduction ? `${entrypoint}.js` : `${entrypoint}.ts`
  const workerPath = isProduction
    ? path.resolve(projectRoot, 'build/workers', filename)
    : path.resolve(projectRoot, 'app/services/jobs', filename)

  const workerOptions: WorkerOptions = {
    execArgv: isProduction ? undefined : ['--import', 'tsx'],
  }

  return { workerPath, workerOptions }
}

function runWorker<T>(
  entrypoint: WorkerEntrypoint,
  workerData: unknown,
  options?: RunWorkerOptions,
): Promise<T> {
  return runWorkerWithRetry<T>(entrypoint, workerData, options)
}

async function runWorkerWithRetry<T>(
  entrypoint: WorkerEntrypoint,
  workerData: unknown,
  options?: RunWorkerOptions,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= SQLITE_BUSY_RETRY_LIMIT; attempt++) {
    try {
      return await runWorkerOnce<T>(entrypoint, workerData)
    } catch (error) {
      lastError = error
      if (!isSqliteBusyError(error) || attempt === SQLITE_BUSY_RETRY_LIMIT) {
        if (isSqliteBusyError(error)) {
          const event = createBusyEvent(
            entrypoint,
            workerData,
            attempt,
            0,
            error,
          )
          logger.warn(formatBusyLog(event))
          options?.onSqliteBusy?.(event)
        }
        throw error
      }

      const delayMs = SQLITE_BUSY_RETRY_DELAYS_MS[attempt] ?? 1000
      const event = createBusyEvent(
        entrypoint,
        workerData,
        attempt,
        delayMs,
        error,
      )
      logger.warn(formatBusyLog(event))
      options?.onSqliteBusy?.(event)
      await delay(delayMs)
    }
  }

  throw lastError
}

function runWorkerOnce<T>(
  entrypoint: WorkerEntrypoint,
  workerData: unknown,
): Promise<T> {
  const { workerPath, workerOptions } = getWorkerRuntime(entrypoint)
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData,
      ...workerOptions,
    })
    worker.on('message', (result: T) => {
      resolve(result)
      worker.terminate()
    })
    worker.on('error', (err) => {
      reject(err)
      worker.terminate()
    })
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`))
      }
    })
  })
}

function isSqliteBusyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('SQLITE_BUSY') || message.includes('database is locked')
  )
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createBusyEvent(
  entrypoint: WorkerEntrypoint,
  workerData: unknown,
  attempt: number,
  delayMs: number,
  error: unknown,
): SqliteBusyEvent {
  return {
    entrypoint,
    organizationId: getWorkerOrganizationId(workerData),
    attempt,
    delayMs,
    errorMessage: error instanceof Error ? error.message : String(error),
    gaveUp: delayMs === 0,
  }
}

function formatBusyLog(event: SqliteBusyEvent) {
  const attemptLabel = event.gaveUp
    ? `giving up after ${event.attempt} retries`
    : `retry ${event.attempt + 1}/${SQLITE_BUSY_RETRY_LIMIT}`
  const waitLabel = event.delayMs > 0 ? `, waiting ${event.delayMs}ms` : ''
  return `[sqlite-busy] ${event.entrypoint} org=${event.organizationId} ${attemptLabel}${waitLabel}: ${event.errorMessage}`
}

function getWorkerOrganizationId(workerData: unknown) {
  if (
    workerData &&
    typeof workerData === 'object' &&
    'organizationId' in workerData &&
    typeof workerData.organizationId === 'string'
  ) {
    return workerData.organizationId
  }

  return 'unknown'
}
