import type { SubmissionResult } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { data, href, redirect } from 'react-router'
import { dataWithError, dataWithSuccess } from 'remix-toast'
import { getErrorMessage } from '~/app/libs/error-message'
import { generateInstallState } from '~/app/libs/github-app-state.server'
import { orgContext } from '~/app/middleware/context'
import { disconnectGithubApp } from '~/app/services/github-app-mutations.server'
import {
  getGithubAppLink,
  getIntegration,
} from '~/app/services/github-integration-queries.server'
import { getGithubAppSlug } from '~/app/services/github-octokit.server'
import ContentSection from '../+components/content-section'
import { IntegrationSettings } from '../_index/+forms/integration-settings'
import { upsertIntegration } from '../_index/+functions/mutations.server'
import { INTENTS, integrationSettingsSchema as schema } from '../_index/+schema'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: (_data: unknown, params: { orgSlug: string }) => ({
    label: 'Integration',
    to: href('/:orgSlug/settings/integration', { orgSlug: params.orgSlug }),
  }),
}

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const [integration, githubAppLink, githubAppSlug] = await Promise.all([
    getIntegration(organization.id),
    getGithubAppLink(organization.id),
    getGithubAppSlug(),
  ])
  const safeIntegration = integration
    ? {
        provider: integration.provider,
        method: integration.method,
        hasToken: !!integration.privateToken,
        appSuspendedAt: integration.appSuspendedAt,
      }
    : null
  const safeGithubAppLink = githubAppLink
    ? {
        githubOrg: githubAppLink.githubOrg,
        appRepositorySelection: githubAppLink.appRepositorySelection,
      }
    : null
  return {
    integration: safeIntegration,
    githubAppLink: safeGithubAppLink,
    githubAppSlug,
  }
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization } = context.get(orgContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === INTENTS.confirmDisconnectGithubApp) {
    return data({ shouldConfirm: true as const })
  }

  if (intent === INTENTS.disconnectGithubApp) {
    try {
      await disconnectGithubApp(organization.id)
    } catch (e) {
      console.error('Failed to disconnect GitHub App:', e)
      const message = getErrorMessage(e)
      return data(
        {
          intent: INTENTS.disconnectGithubApp,
          lastResult: {
            error: { '': [message] },
          } as SubmissionResult,
          shouldConfirm: true,
        },
        { status: 400 },
      )
    }

    return dataWithSuccess(
      {
        intent: INTENTS.disconnectGithubApp,
        lastResult: undefined,
      },
      { message: 'GitHub App disconnected' },
    )
  }

  if (intent === INTENTS.confirmRevertToToken) {
    return data({ shouldConfirm: true as const })
  }

  if (intent === INTENTS.revertToToken) {
    try {
      await disconnectGithubApp(organization.id)
    } catch (e) {
      console.error('Failed to revert to token:', e)
      const message = getErrorMessage(e)
      return data(
        {
          intent: INTENTS.revertToToken,
          lastResult: {
            error: { '': [message] },
          } as SubmissionResult,
          shouldConfirm: true,
        },
        { status: 400 },
      )
    }

    return dataWithSuccess(
      {
        intent: INTENTS.revertToToken,
        lastResult: undefined,
      },
      { message: 'Switched to personal access token' },
    )
  }

  if (
    intent === INTENTS.installGithubApp ||
    intent === INTENTS.copyInstallUrl
  ) {
    const slug = await getGithubAppSlug()
    if (!slug) {
      return dataWithError(
        { intent: intent as string },
        {
          message:
            'GitHub App is not configured (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY missing)',
        },
      )
    }
    const baseUrl = `https://github.com/apps/${slug}/installations/new`
    const nonce = await generateInstallState(organization.id)
    const installUrl = `${baseUrl}?state=${encodeURIComponent(nonce)}`

    if (intent === INTENTS.installGithubApp) {
      throw redirect(installUrl)
    }
    return data({
      intent: INTENTS.copyInstallUrl,
      installUrl,
    })
  }

  const submission = await parseWithZod(formData, { schema })
  if (submission.status !== 'success') {
    return {
      intent: 'integration-settings' as const,
      lastResult: submission.reply(),
    }
  }

  const activeGithubAppLink = await getGithubAppLink(organization.id)
  const existingIntegration = await getIntegration(organization.id)
  if (activeGithubAppLink && existingIntegration?.method === 'github_app') {
    const message =
      'GitHub App is connected. Use the App section to manage the connection.'
    return dataWithError(
      {
        intent: 'integration-settings' as const,
        lastResult: submission.reply({ formErrors: [message] }),
      },
      { message },
    )
  }

  try {
    const { privateToken, ...rest } = submission.value

    if (submission.value.method === 'github_app') {
      const resolvedToken = privateToken
        ? privateToken
        : (existingIntegration?.privateToken ?? null)
      await upsertIntegration(organization.id, {
        ...rest,
        privateToken: resolvedToken,
      })
    } else if (!privateToken) {
      if (!existingIntegration?.privateToken) {
        const message = 'Private token is required for new integrations.'
        return dataWithError(
          {
            intent: 'integration-settings' as const,
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
        intent: 'integration-settings' as const,
        lastResult: submission.reply({ formErrors: [message] }),
      },
      { message },
    )
  }

  return dataWithSuccess(
    {
      intent: 'integration-settings' as const,
      lastResult: submission.reply(),
    },
    {
      message: 'Update integration settings successfully',
    },
  )
}

export default function IntegrationSettingsPage({
  loaderData: { integration, githubAppLink },
}: Route.ComponentProps) {
  return (
    <ContentSection
      title="Integration"
      desc="Configure your GitHub integration settings."
    >
      <IntegrationSettings
        integration={integration ?? undefined}
        githubAppLink={githubAppLink}
      />
    </ContentSection>
  )
}
