import { href, redirect } from 'react-router'
import { getSession } from '~/app/libs/auth.server'
import {
  consumeAuthorizedInstallStateDetailed,
  getAuthorizedInstallStateOrganization,
  InstallStateError,
  releaseConsumedInstallState,
} from '~/app/libs/github-app-state.server'
import { db } from '~/app/services/db.server'
import {
  completeGithubAppSetup,
  GithubInstallationAlreadyLinkedError,
  GithubInstallationAuthorizationError,
  verifyGithubInstallation,
  verifyUserCanManageGithubInstallation,
} from '~/app/services/github-app-setup.server'
import type { OrganizationId } from '~/app/types/organization'
import type { Route } from './+types/api.github.setup'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url)
  const installationIdParam = url.searchParams.get('installation_id')
  const state = url.searchParams.get('state')
  if (!installationIdParam) {
    return new Response('Missing installation_id', { status: 400 })
  }

  const installationId = Number(installationIdParam)
  if (!Number.isInteger(installationId) || installationId < 1) {
    return new Response('Invalid installation_id', { status: 400 })
  }

  const session = await getSession(request)
  if (!session?.user) {
    const redirectTo = url.pathname + url.search
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`)
  }

  // The installation id is the durable identity. GitHub can return an old
  // state when an already-installed app is configured from a stale tab; an
  // active link must use its existing-link authorization path in that case.
  const existingLink = await db
    .selectFrom('githubAppLinks as link')
    .innerJoin('organizations as org', 'org.id', 'link.organizationId')
    .select(['link.organizationId', 'org.slug'])
    .where('link.installationId', '=', installationId)
    .where('link.deletedAt', 'is', null)
    .executeTakeFirst()

  let liveExistingState = false
  if (existingLink && state?.trim()) {
    const intendedOrganizationId = await getAuthorizedInstallStateOrganization(
      state,
      session.user.id,
    )
    if (
      intendedOrganizationId &&
      intendedOrganizationId !== existingLink.organizationId
    ) {
      return new Response(
        'This GitHub installation is already linked to another Upflow organization.',
        { status: 409 },
      )
    }
    liveExistingState = intendedOrganizationId === existingLink.organizationId
  }

  let installation
  try {
    installation = await verifyGithubInstallation(installationId)
  } catch {
    return new Response('Could not verify GitHub installation', { status: 502 })
  }

  const existingLinkOwner = existingLink
    ? await db
        .selectFrom('members')
        .select('id')
        .where('organizationId', '=', existingLink.organizationId)
        .where('userId', '=', session.user.id)
        .where('role', '=', 'owner')
        .executeTakeFirst()
    : undefined

  if (existingLink && !existingLinkOwner) {
    try {
      await verifyUserCanManageGithubInstallation(session.user.id, installation)
    } catch (error) {
      if (!(error instanceof GithubInstallationAuthorizationError)) throw error
      console.warn('[api.github.setup] GitHub owner verification failed', error)
      return new Response(error.message, { status: 403 })
    }
  }

  let organizationId: OrganizationId
  let consumedStateId: string | null = null
  if (existingLink) {
    // Repository-selection updates for an already-linked installation carry
    // no state. The durable link plus the owner check above establishes the
    // tenant; consuming a new-link intent here would invalidate another flow.
    organizationId = existingLink.organizationId as OrganizationId
    if (liveExistingState) {
      try {
        const consumed = await consumeAuthorizedInstallStateDetailed({
          installationId,
          nonce: state,
          userId: session.user.id,
        })
        consumedStateId = consumed.stateId
      } catch (e) {
        if (e instanceof InstallStateError) {
          // Another callback may have consumed the same state after the live
          // check above. The durable existing link plus owner authorization
          // already establish this update's tenant, so do not drop the GitHub
          // repository-selection change solely because of that race.
          console.warn(
            '[api.github.setup] existing-link install state was already retired',
            e,
          )
        } else {
          throw e
        }
      }
    }
  } else {
    try {
      const consumed = await consumeAuthorizedInstallStateDetailed({
        installationId,
        nonce: state,
        userId: session.user.id,
      })
      consumedStateId = consumed.stateId
      await verifyUserCanManageGithubInstallation(session.user.id, installation)
      organizationId = consumed.organizationId
    } catch (e) {
      if (e instanceof GithubInstallationAuthorizationError) {
        console.warn('[api.github.setup] GitHub owner verification failed', e)
        if (consumedStateId) {
          await releaseConsumedInstallState(consumedStateId).catch(
            (releaseError) =>
              console.error(
                '[api.github.setup] failed to release install state',
                releaseError,
              ),
          )
        }
        return new Response(
          state?.trim()
            ? e.message
            : 'This GitHub installation cannot be connected.',
          { status: 403 },
        )
      }
      if (e instanceof InstallStateError) {
        return new Response(e.message, { status: 400 })
      }
      if (consumedStateId) {
        await releaseConsumedInstallState(consumedStateId).catch(
          (releaseError) =>
            console.error(
              '[api.github.setup] failed to release install state',
              releaseError,
            ),
        )
      }
      throw e
    }
  }

  try {
    await completeGithubAppSetup({
      organizationId,
      installation,
      source: existingLink
        ? 'installation_update_callback'
        : state?.trim()
          ? 'setup_callback'
          : 'existing_installation_link',
    })
  } catch (e) {
    console.error('[api.github.setup]', e)
    if (e instanceof GithubInstallationAlreadyLinkedError) {
      if (consumedStateId) {
        await releaseConsumedInstallState(consumedStateId).catch(
          (releaseError) =>
            console.error(
              '[api.github.setup] failed to release install state',
              releaseError,
            ),
        )
      }
      return new Response(e.message, { status: 409 })
    }
    if (consumedStateId) {
      await releaseConsumedInstallState(consumedStateId).catch((releaseError) =>
        console.error(
          '[api.github.setup] failed to release install state',
          releaseError,
        ),
      )
    }
    return new Response('Failed to save installation', { status: 500 })
  }

  const org =
    existingLink ??
    (await db
      .selectFrom('organizations')
      .select(['slug', 'id'])
      .where('id', '=', organizationId)
      .executeTakeFirst())

  if (!org) {
    throw redirect('/')
  }

  const member =
    existingLinkOwner ??
    (await db
      .selectFrom('members')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('userId', '=', session.user.id)
      .where('role', '=', 'owner')
      .executeTakeFirst())

  if (!member) {
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>GitHub App connected</title><p>The GitHub App was connected successfully. You may close this window and tell the Upflow organization owner.</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  throw redirect(href('/:orgSlug/settings/integration', { orgSlug: org.slug }))
}
