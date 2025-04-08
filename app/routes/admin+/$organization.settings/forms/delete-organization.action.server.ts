import { parseWithZod } from '@conform-to/zod'
import { href, redirect } from 'react-router'
import type { Route } from '../+types/route'
import { deleteOrganization } from '../functions.server'
import { INTENTS, deleteOrganizationSchema as schema } from '../types'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.deleteOrganization,
      lastResult: submission.reply(),
    }
  }

  await deleteOrganization(params.organization)

  throw redirect(href('/admin'))
}
