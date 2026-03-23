import type { Durably } from '@coji/durably'
import {
  captureException,
  captureMessage,
  flush,
  getClient,
  init,
} from '@sentry/node'

/** Any concrete Durably instance from createDurably (job/label types vary). */
type DurablyInstance = Durably<
  // biome-ignore lint/suspicious/noExplicitAny: durably jobs are a closed union per app
  any,
  Record<string, string>
>

function parseSampleRate(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 0
  const n = Number(raw)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

/**
 * Ensures @sentry/node is initialized when SENTRY_DSN is set.
 * Skips if a client already exists (e.g. web process after instrument.server.mjs + @sentry/react-router).
 */
export function ensureSentryNodeInitialized() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  if (getClient()) return

  init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
    sendDefaultPii: false,
  })
}

export function captureExceptionToSentry(
  error: unknown,
  captureContext?: Parameters<typeof captureException>[1],
) {
  ensureSentryNodeInitialized()
  if (!getClient()) return
  captureException(error, captureContext)
}

export function registerDurablySentryListeners(durably: DurablyInstance) {
  ensureSentryNodeInitialized()
  if (!getClient()) return

  durably.on('run:fail', (event) => {
    const err = new Error(event.error)
    err.name = `DurablyJob:${event.jobName}`
    captureException(err, {
      tags: {
        'durably.job': event.jobName,
        'durably.step': event.failedStepName,
      },
      extra: {
        runId: event.runId,
        labels: event.labels,
      },
    })
  })

  durably.on('worker:error', (event) => {
    captureMessage(event.error, {
      level: 'error',
      tags: { 'durably.context': event.context },
      extra: { runId: event.runId },
    })
  })
}

export async function flushSentryNode(timeoutMs = 2000) {
  if (!getClient()) return
  await flush(timeoutMs)
}
