import { nanoid } from 'nanoid'
import { href, redirect } from 'react-router'
import { getSession } from '~/app/libs/auth.server'
import {
  consumeInstallState,
  InstallStateError,
} from '~/app/libs/github-app-state.server'
import { clearOrgCache } from '~/app/services/cache.server'
import { db } from '~/app/services/db.server'
import { createAppOctokit } from '~/app/services/github-octokit.server'
import type { OrganizationId } from '~/app/types/organization'
import type { Route } from './+types/api.github.setup'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url)
  const installationIdParam = url.searchParams.get('installation_id')
  const state = url.searchParams.get('state')
  if (!installationIdParam || !state?.trim()) {
    return new Response('Missing installation_id or state', { status: 400 })
  }

  const installationId = Number(installationIdParam)
  if (!Number.isInteger(installationId) || installationId < 1) {
    return new Response('Invalid installation_id', { status: 400 })
  }

  let installation: {
    id: number
    account: { id: number; login: string }
    repository_selection?: 'all' | 'selected' | null
  }

  try {
    const appOctokit = createAppOctokit()
    const { data } = await appOctokit.rest.apps.getInstallation({
      installation_id: installationId,
    })
    const account = data.account
    if (!account || typeof account.id !== 'number') {
      return new Response('Invalid installation account', { status: 502 })
    }
    if (!('login' in account) || typeof account.login !== 'string') {
      return new Response('Invalid installation account', { status: 502 })
    }
    installation = {
      id: data.id,
      account: { id: account.id, login: account.login },
      repository_selection: data.repository_selection,
    }
  } catch {
    return new Response('Could not verify GitHub installation', { status: 502 })
  }

  let organizationId: OrganizationId
  try {
    const consumed = await consumeInstallState(state)
    organizationId = consumed.organizationId
  } catch (e) {
    if (e instanceof InstallStateError) {
      return new Response(e.message, { status: 400 })
    }
    throw e
  }

  const appRepositorySelection =
    installation.repository_selection === 'selected' ? 'selected' : 'all'
  const now = new Date().toISOString()

  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('githubAppLinks')
        .values({
          organizationId,
          installationId: installation.id,
          githubAccountId: installation.account.id,
          githubOrg: installation.account.login,
          appRepositorySelection,
          deletedAt: null,
        })
        .onConflict((oc) =>
          oc.column('organizationId').doUpdateSet({
            installationId: installation.id,
            githubAccountId: installation.account.id,
            githubOrg: installation.account.login,
            appRepositorySelection,
            deletedAt: null,
            updatedAt: now,
          }),
        )
        .execute()

      await trx
        .insertInto('integrations')
        .values({
          id: nanoid(),
          organizationId,
          provider: 'github',
          method: 'github_app',
          privateToken: null,
          appSuspendedAt: null,
        })
        .onConflict((oc) =>
          oc.column('organizationId').doUpdateSet({
            method: 'github_app',
            appSuspendedAt: null,
            updatedAt: now,
          }),
        )
        .execute()
    })
  } catch (e) {
    console.error('[api.github.setup]', e)
    return new Response('Failed to save installation', { status: 500 })
  }

  clearOrgCache(organizationId)

  const session = await getSession(request)
  if (!session?.user) {
    throw redirect(href('/login'))
  }

  const org = await db
    .selectFrom('organizations')
    .select(['slug', 'id'])
    .where('id', '=', organizationId)
    .executeTakeFirst()

  if (!org) {
    throw redirect('/')
  }

  const member = await db
    .selectFrom('members')
    .select('id')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', session.user.id)
    .executeTakeFirst()

  if (!member) {
    throw redirect('/')
  }

  throw redirect(href('/:orgSlug/settings/integration', { orgSlug: org.slug }))
}
