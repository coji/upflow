import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import { INTENTS, deleteOrganizationSchema as schema } from '../+schema'
import type { Route } from '../+types/_layout'
import { deleteOrganization } from '../functions.server'

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization, membership } = await requireOrgAdmin(
    request,
    params.orgSlug,
  )
  if (membership.role !== 'owner') {
    throw new Response('Only the organization owner can delete it', {
      status: 403,
    })
  }

  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== 'success') {
    return {
      intent: INTENTS.deleteOrganization,
      lastResult: submission.reply(),
    }
  }

  await deleteOrganization(organization.id)

  throw redirect('/')
}
