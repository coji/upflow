import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { heapStats } from 'bun:jsc'
import { z } from 'zod'
import { zx } from 'zodix'

export const loader = ({ request }: LoaderFunctionArgs) => {
  const { action } = zx.parseQuery(request, {
    action: z.enum(['gc', 'stat']).default('stat'),
  })

  if (action === 'stat') {
    return json({ heapStats: heapStats() })
  }
  if (action === 'gc') {
    const beforeHeapSize = heapStats().heapSize
    Bun.gc(true)
    const afterHeapSize = heapStats().heapSize
    return json({ beforeHeapSize, afterHeapSize })
  } else {
    return json({})
  }
}
