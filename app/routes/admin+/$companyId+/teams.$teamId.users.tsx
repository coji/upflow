import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { zx } from 'zodix'

export const loader = ({ request, params }: LoaderFunctionArgs) => {
  const { companyId, teamId } = zx.parseParams(params, {
    companyId: z.string(),
    teamId: z.string(),
  })
  return json({ companyId, teamId })
}

export default function TeamUsers() {
  return (
    <div>
      <h1>TeamUsers</h1>
    </div>
  )
}
