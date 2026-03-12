import type { LoaderFunction } from 'react-router'
import { db, sql } from '~/app/services/db.server'

export const loader: LoaderFunction = async () => {
  try {
    await sql`SELECT 1`.execute(db)
    return new Response('OK')
  } catch (error: unknown) {
    console.error('healthcheck ❌', error)
    return new Response('ERROR', { status: 500 })
  }
}
