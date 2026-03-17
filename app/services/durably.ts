import { createDurably } from '@coji/durably-react'
import type { durably as serverDurably } from './durably.server'

export const durably = createDurably<typeof serverDurably>({
  api: '/api/durably',
})
