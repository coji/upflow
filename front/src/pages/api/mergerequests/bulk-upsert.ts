// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { MergeRequestSchema } from '~/schema/mergerequest'
import z, { ZodError } from 'zod'
import { MergeRequest, upsertMergeRequest } from '~/models/mergeRequest.server'

type Data = {
  ok: boolean
  message?: string | object
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.status(500).json({ ok: false, message: 'invalid method' })
    return
  }

  try {
    z.array(MergeRequestSchema).parse(req.body.items)
    const items: MergeRequest[] = req.body.items
    for (const mr of items) {
      console.log(mr)
      await upsertMergeRequest(mr)
    }
  } catch (e) {
    console.log('Error:', e)
    res.status(500).json({ ok: false, message: e as object })
    return
  }

  res.status(200).json({ ok: true })
}
