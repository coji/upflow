import * as Sentry from '@sentry/react-router'
import 'dotenv/config'

const dsn = process.env.SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    // https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#sendDefaultPii
    sendDefaultPii: true,
    tracesSampleRate: 0,
  })
}
