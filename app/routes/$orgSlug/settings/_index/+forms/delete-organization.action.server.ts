import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import type { Route } from '../+types/_layout'
import { deleteOrganization } from '../functions.server'
import { INTENTS, deleteOrganizationSchema as schema } from '../+schema'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.deleteOrganization,
      lastResult: submission.reply(),
    }
  }

  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  await deleteOrganization(organization.id)

  throw redirect('/admin')
}
