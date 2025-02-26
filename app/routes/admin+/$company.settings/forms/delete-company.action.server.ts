import { parseWithZod } from '@conform-to/zod'
import { href, redirect } from 'react-router'
import type { Route } from '../+types/route'
import { deleteCompany } from '../functions.server'
import { INTENTS, deleteCompanySchema as schema } from '../types'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.deleteCompany,
      lastResult: submission.reply(),
    }
  }

  await deleteCompany(params.company)

  throw redirect(href('/admin'))
}
