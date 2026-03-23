import * as Sentry from '@sentry/react-router'
import 'dotenv/config'

function parseSampleRate(raw) {
  if (raw === undefined || raw === '') return 0
  const n = Number(raw)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

const dsn = process.env.SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
  })
}
