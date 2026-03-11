import { data } from 'react-router'
import { z } from 'zod'
import { requireOrgMember } from '~/app/libs/auth.server'
import { PR_SIZE_LABELS } from '~/app/routes/$orgSlug/reviews/+functions/classify'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { Route } from './+types/pr-size-feedback'

const feedbackSchema = z.object({
  pullRequestNumber: z.coerce.number().int(),
  repositoryId: z.string().min(1),
  correctedComplexity: z.enum(PR_SIZE_LABELS),
  reason: z.string().nullish(),
})

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization, user } = await requireOrgMember(request, params.orgSlug)
  const formData = await request.formData()
  const parsed = feedbackSchema.safeParse({
    pullRequestNumber: formData.get('pullRequestNumber'),
    repositoryId: formData.get('repositoryId'),
    correctedComplexity: formData.get('correctedComplexity'),
    reason: formData.get('reason'),
  })

  if (!parsed.success) {
    return data({ error: 'Invalid input' }, { status: 400 })
  }

  const { pullRequestNumber, repositoryId, correctedComplexity, reason } =
    parsed.data
  const tenantDb = getTenantDb(organization.id)

  // Get current complexity (also verifies PR exists in this tenant DB)
  const pr = await tenantDb
    .selectFrom('pullRequests')
    .select('complexity')
    .where('number', '=', pullRequestNumber)
    .where('repositoryId', '=', repositoryId)
    .executeTakeFirst()

  if (!pr) {
    return data({ error: 'Pull request not found' }, { status: 404 })
  }

  // Upsert feedback
  const now = new Date().toISOString()
  await tenantDb
    .insertInto('pullRequestFeedbacks')
    .values({
      pullRequestNumber,
      repositoryId,
      originalComplexity: pr.complexity,
      correctedComplexity,
      reason: reason ?? null,
      feedbackBy: user.name,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.columns(['pullRequestNumber', 'repositoryId']).doUpdateSet({
        correctedComplexity,
        reason: reason ?? null,
        feedbackBy: user.name,
        updatedAt: now,
      }),
    )
    .execute()

  return data({ ok: true })
}
