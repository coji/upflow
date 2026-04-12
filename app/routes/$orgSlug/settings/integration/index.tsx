import { parseWithZod } from '@conform-to/zod/v4'
import { data, href, redirect } from 'react-router'
import { dataWithError, dataWithSuccess } from 'remix-toast'
import { match } from 'ts-pattern'
import { requireOrgOwner } from '~/app/libs/auth.server'
import { getErrorMessage } from '~/app/libs/error-message'
import { generateInstallState } from '~/app/libs/github-app-state.server'
import { orgContext } from '~/app/middleware/context'
import { reassignCanonicalAfterLinkLoss } from '~/app/services/github-app-membership.server'
import {
  disconnectGithubApp,
  disconnectGithubAppLink,
} from '~/app/services/github-app-mutations.server'
import {
  assertInstallationBelongsToOrg,
  getGithubAppLinks,
  getIntegration,
} from '~/app/services/github-integration-queries.server'
import { getGithubAppSlug } from '~/app/services/github-octokit.server'
import type { OrganizationId } from '~/app/types/organization'
import ContentSection from '../+components/content-section'
import { IntegrationSettings } from '../_index/+forms/integration-settings'
import { upsertIntegration } from '../_index/+functions/mutations.server'
import { INTENTS, integrationActionSchema } from '../_index/+schema'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Integration',
    to: href('/:orgSlug/settings/integration', { orgSlug: params.orgSlug }),
  }),
}

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const [integration, githubAppLinks, githubAppSlug] = await Promise.all([
    getIntegration(organization.id),
    getGithubAppLinks(organization.id),
    getGithubAppSlug(),
  ])
  const safeIntegration = integration
    ? {
        provider: integration.provider,
        method: integration.method,
        hasToken: !!integration.privateToken,
      }
    : null
  const safeGithubAppLinks = githubAppLinks.map((l) => ({
    installationId: l.installationId,
    githubOrg: l.githubOrg,
    githubAccountType: l.githubAccountType,
    appRepositorySelection: l.appRepositorySelection,
    suspendedAt: l.suspendedAt,
    membershipInitializedAt: l.membershipInitializedAt,
  }))
  return {
    integration: safeIntegration,
    githubAppLinks: safeGithubAppLinks,
    githubAppSlug,
  }
}

const githubAppNotConfigured = (
  intent: INTENTS.installGithubApp | INTENTS.copyInstallUrl,
) =>
  dataWithError(
    { intent },
    {
      message:
        'GitHub App is not configured (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY missing)',
    },
  )

async function buildInstallUrl(
  organizationId: OrganizationId,
): Promise<string | null> {
  const slug = await getGithubAppSlug()
  if (!slug) return null
  const nonce = await generateInstallState(organizationId)
  return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(nonce)}`
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization, membership } = context.get(orgContext)
  requireOrgOwner(membership, organization.slug)
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: integrationActionSchema })
  if (submission.status !== 'success') {
    return data(
      {
        intent: INTENTS.integrationSettings,
        lastResult: submission.reply(),
      },
      { status: 400 },
    )
  }

  const confirmGuard = (intent: INTENTS) =>
    data({
      intent,
      lastResult: undefined,
      shouldConfirm: true as const,
    })

  const errorWithDialog = (intent: INTENTS, message: string) =>
    data(
      {
        intent,
        lastResult: submission.reply({ formErrors: [message] }),
        shouldConfirm: true as const,
      },
      { status: 400 },
    )

  return match(submission.value)
    .with({ intent: INTENTS.confirmDisconnectGithubApp }, () =>
      confirmGuard(INTENTS.confirmDisconnectGithubApp),
    )
    .with({ intent: INTENTS.confirmDisconnectGithubAppLink }, () =>
      confirmGuard(INTENTS.confirmDisconnectGithubAppLink),
    )
    .with({ intent: INTENTS.confirmRevertToToken }, () =>
      confirmGuard(INTENTS.confirmRevertToToken),
    )
    .with({ intent: INTENTS.disconnectGithubAppLink }, async (v) => {
      try {
        await assertInstallationBelongsToOrg(organization.id, v.installationId)
        await disconnectGithubAppLink(organization.id, v.installationId)
      } catch (e) {
        console.error('Failed to disconnect GitHub App link:', e)
        return errorWithDialog(
          INTENTS.disconnectGithubAppLink,
          getErrorMessage(e),
        )
      }
      // Mirror the webhook path: soft-deleting the link leaves repositories
      // whose `githubInstallationId` points at it dangling. Reassign them to
      // another eligible installation (or clear to null) before returning.
      await reassignCanonicalAfterLinkLoss({
        organizationId: organization.id,
        lostInstallationId: v.installationId,
        source: 'user_disconnect',
      })
      return dataWithSuccess(
        { intent: INTENTS.disconnectGithubAppLink, lastResult: undefined },
        { message: 'GitHub App installation disconnected' },
      )
    })
    .with({ intent: INTENTS.disconnectGithubApp }, async () => {
      try {
        await disconnectGithubApp(organization.id)
      } catch (e) {
        console.error('Failed to disconnect GitHub App:', e)
        return errorWithDialog(INTENTS.disconnectGithubApp, getErrorMessage(e))
      }
      return dataWithSuccess(
        { intent: INTENTS.disconnectGithubApp, lastResult: undefined },
        { message: 'GitHub App disconnected' },
      )
    })
    .with({ intent: INTENTS.revertToToken }, async () => {
      try {
        await disconnectGithubApp(organization.id)
      } catch (e) {
        console.error('Failed to revert to token:', e)
        return errorWithDialog(INTENTS.revertToToken, getErrorMessage(e))
      }
      return dataWithSuccess(
        { intent: INTENTS.revertToToken, lastResult: undefined },
        { message: 'Switched to personal access token' },
      )
    })
    .with({ intent: INTENTS.installGithubApp }, async () => {
      const installUrl = await buildInstallUrl(organization.id)
      if (!installUrl) return githubAppNotConfigured(INTENTS.installGithubApp)
      throw redirect(installUrl)
    })
    .with({ intent: INTENTS.copyInstallUrl }, async () => {
      const installUrl = await buildInstallUrl(organization.id)
      if (!installUrl) return githubAppNotConfigured(INTENTS.copyInstallUrl)
      return data({ intent: INTENTS.copyInstallUrl, installUrl })
    })
    .with({ intent: INTENTS.integrationSettings }, async (v) => {
      const [activeGithubAppLinks, existingIntegration] = await Promise.all([
        getGithubAppLinks(organization.id),
        getIntegration(organization.id),
      ])
      if (
        activeGithubAppLinks.length > 0 &&
        existingIntegration?.method === 'github_app'
      ) {
        const message =
          'GitHub App is connected. Use the App section to manage the connection.'
        return dataWithError(
          {
            intent: INTENTS.integrationSettings,
            lastResult: submission.reply({ formErrors: [message] }),
          },
          { message },
        )
      }

      try {
        const { privateToken, intent: _ignored, ...rest } = v
        if (v.method === 'github_app') {
          await upsertIntegration(organization.id, {
            ...rest,
            privateToken:
              privateToken || (existingIntegration?.privateToken ?? null),
          })
        } else if (!privateToken) {
          if (!existingIntegration?.privateToken) {
            const message = 'Private token is required for new integrations.'
            return dataWithError(
              {
                intent: INTENTS.integrationSettings,
                lastResult: submission.reply({ formErrors: [message] }),
              },
              { message },
            )
          }
          await upsertIntegration(organization.id, {
            ...rest,
            privateToken: existingIntegration.privateToken,
          })
        } else {
          await upsertIntegration(organization.id, { ...rest, privateToken })
        }
      } catch (e) {
        console.error('Failed to update integration:', e)
        const message = getErrorMessage(e)
        return dataWithError(
          {
            intent: INTENTS.integrationSettings,
            lastResult: submission.reply({ formErrors: [message] }),
          },
          { message },
        )
      }

      return dataWithSuccess(
        {
          intent: INTENTS.integrationSettings,
          lastResult: submission.reply(),
        },
        { message: 'Update integration settings successfully' },
      )
    })
    .exhaustive()
}

export default function IntegrationSettingsPage({
  loaderData: { integration, githubAppLinks },
}: Route.ComponentProps) {
  return (
    <ContentSection
      title="Integration"
      desc="Configure your GitHub integration settings."
    >
      <IntegrationSettings
        integration={integration ?? undefined}
        githubAppLinks={githubAppLinks}
      />
    </ContentSection>
  )
}
