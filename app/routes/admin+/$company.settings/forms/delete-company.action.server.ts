import { parseWithZod } from '@conform-to/zod'
import { redirect } from 'react-router'
import { $path } from 'safe-routes'
import { deleteCompany } from '../functions.server'
import { INTENTS, deleteCompanySchema as schema } from '../types'
import type { Route } from './+types'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.deleteCompany,
      lastResult: submission.reply(),
    }
  }

  await deleteCompany(params.company)

  throw redirect($path('/admin'))
}
