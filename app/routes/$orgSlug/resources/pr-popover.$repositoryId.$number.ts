import { data } from 'react-router'
import { captureExceptionToSentry } from '~/app/libs/sentry-node.server'
import { orgContext } from '~/app/middleware/context'
import { getPullRequestForPopover } from '~/app/services/pr-popover-queries.server'
import type { Route } from './+types/pr-popover.$repositoryId.$number'

export const loader = async ({ params, context }: Route.LoaderArgs) => {
  const repositoryId = params.repositoryId?.trim() ?? ''
  const number = Number(params.number)
  if (!repositoryId || !Number.isFinite(number)) {
    return data(
      { pr: null, error: 'not_found' as const },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const { organization } = context.get(orgContext)

  try {
    const pr = await getPullRequestForPopover(
      organization.id,
      repositoryId,
      number,
    )
    if (pr) {
      return data(
        { pr },
        { headers: { 'Cache-Control': 'private, max-age=30' } },
      )
    }
    return data(
      { pr: null, error: 'not_found' as const },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    captureExceptionToSentry(e, {
      extra: { organizationId: organization.id, repositoryId, number },
    })
    return data(
      { pr: null, error: 'fetch_failed' as const },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
