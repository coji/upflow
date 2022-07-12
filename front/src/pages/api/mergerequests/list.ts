// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { MergeRequestSchema } from '~/schema/mergerequest'
import z, { ZodError } from 'zod'
import { MergeRequest, getMergeRequestItems } from '~/models/mergeRequest.server'

type Data = {
  items: MergeRequest[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  res.status(200).json({ items: await getMergeRequestItems() })
}
