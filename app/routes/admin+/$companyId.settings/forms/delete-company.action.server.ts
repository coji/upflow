import { parseWithZod } from '@conform-to/zod'
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node'
import { $path } from 'remix-routes'
import { deleteCompany } from '../functions.server'
import { INTENTS, deleteCompanySchema as schema } from '../types'

export const action = async ({ request }: ActionFunctionArgs) => {
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return json({
      intent: INTENTS.deleteCompany,
      lastResult: submission.reply(),
    })
  }

  await deleteCompany(submission.value.company_id)

  return redirect($path('/admin'))
}
