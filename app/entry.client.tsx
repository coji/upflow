import * as Sentry from '@sentry/react-router'
import { startTransition, StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { HydratedRouter } from 'react-router/dom'

function parseSampleRate(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 0
  const n = Number(raw)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

const dsn = import.meta.env.VITE_SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    integrations: [],
    tracesSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
    ),
  })
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  )
})
