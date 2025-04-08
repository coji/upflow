import { consola } from 'consola'
import type { LoaderFunction } from 'react-router'
import { db, sql } from '~/app/services/db.server'

export const loader: LoaderFunction = async ({ request }) => {
  const host =
    request.headers.get('X-Forwarded-Host') ?? request.headers.get('host')

  try {
    const url = new URL('/login', `http://${host}`)
    // if we can connect to the database and make a simple query
    // and make a HEAD request to ourselves, then we're good.
    await Promise.all([
      sql`SELECT * FROM users;`.execute(db),
      fetch(url.toString(), { method: 'HEAD' }).then((r) => {
        if (!r.ok) return Promise.reject(r)
      }),
    ])
    return new Response('OK')
  } catch (error: unknown) {
    consola.error('healthcheck ❌', { error })
    return new Response('ERROR', { status: 500 })
  }
}
