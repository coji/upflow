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
    beforeSend(event) {
      // Filter out react-router internal errors (404 bot/scanner noise, 400 missing loader)
      const serialized = event.extra?.__serialized__
      if (
        serialized &&
        typeof serialized === 'object' &&
        serialized.internal === true &&
        (serialized.status === 404 || serialized.status === 400)
      ) {
        return null
      }
      return event
    },
  })
}
