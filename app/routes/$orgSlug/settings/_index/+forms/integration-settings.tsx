import type { SubmissionResult } from '@conform-to/react'
import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
} from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { ExternalLinkIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Form, useActionData, useFetcher, useNavigation } from 'react-router'
import { toast } from 'sonner'
import type { z } from 'zod'
import type { ConfirmDialogData } from '~/app/components/confirm-dialog'
import { ConfirmDialog } from '~/app/components/confirm-dialog'
import Github from '~/app/components/icons/Github'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  HStack,
  Label,
  RadioGroup,
  RadioGroupItem,
  Stack,
  Textarea,
} from '~/app/components/ui'
import {
  buildInstallationSettingsUrl,
  isPersonalAccount,
} from '~/app/libs/github-account'
import { INTENTS, integrationSettingsSchema as schema } from '../+schema'
import type { action } from '../../integration/index'

export type GithubAppLinkSummary = {
  installationId: number
  githubOrg: string
  githubAccountType: string | null
  appRepositorySelection: 'all' | 'selected'
  suspendedAt: string | null
  membershipInitializedAt: string | null
}

export interface IntegrationSettingsProps {
  integration?: {
    provider: string
    method: 'token' | 'github_app'
    hasToken: boolean
  }
  githubAppLinks: GithubAppLinkSummary[]
}

function InstallationCard({ link }: { link: GithubAppLinkSummary }) {
  const disconnectFetcher = useFetcher<ConfirmDialogData>()
  const settingsUrl = buildInstallationSettingsUrl(link)
  const isPersonal = isPersonalAccount(link)
  const isSuspended = link.suspendedAt !== null
  const needsRepair = link.membershipInitializedAt === null

  return (
    <Stack gap="2" className="border-muted rounded-md border p-3">
      <div className="space-y-1">
        <p className="text-sm">
          {isPersonal ? 'Personal account ' : 'Organization '}
          <span className="font-medium">{link.githubOrg}</span>
          {link.appRepositorySelection === 'selected' ? (
            <span className="text-muted-foreground">
              {' '}
              (selected repositories only)
            </span>
          ) : null}
        </p>
        <p className="text-muted-foreground text-xs">
          Installation #{link.installationId}
        </p>
      </div>

      {isSuspended && (
        <Alert variant="destructive">
          <AlertTitle>Suspended</AlertTitle>
          <AlertDescription>
            GitHub has suspended this installation. Unsuspend it in GitHub to
            resume syncing.
          </AlertDescription>
        </Alert>
      )}

      {needsRepair && (
        <Alert>
          <AlertTitle>Initializing membership</AlertTitle>
          <AlertDescription>
            Repository visibility is being initialized. The next crawl will
            complete this automatically.
          </AlertDescription>
        </Alert>
      )}

      <HStack className="flex-wrap">
        <Button variant="outline" size="sm" asChild>
          <a href={settingsUrl} target="_blank" rel="noreferrer">
            <ExternalLinkIcon className="mr-1 h-4 w-4" />
            GitHub App settings
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            disconnectFetcher.submit(
              {
                intent: INTENTS.confirmDisconnectGithubAppLink,
                installationId: String(link.installationId),
              },
              { method: 'POST' },
            )
          }}
        >
          Disconnect
        </Button>
      </HStack>

      <ConfirmDialog
        title="Disconnect GitHub App installation"
        desc={`Disconnect installation #${link.installationId} (${link.githubOrg}). Repositories tied to it will be reassigned to another active installation if available, or marked as needing manual reassignment.`}
        confirmText="Disconnect"
        destructive
        fetcher={disconnectFetcher}
      >
        <input
          type="hidden"
          name="intent"
          value={INTENTS.disconnectGithubAppLink}
        />
        <input
          type="hidden"
          name="installationId"
          value={String(link.installationId)}
        />
      </ConfirmDialog>
    </Stack>
  )
}

function GitHubAppSection({
  integration,
  githubAppLinks,
}: Pick<IntegrationSettingsProps, 'integration' | 'githubAppLinks'>) {
  const revertFetcher = useFetcher<ConfirmDialogData>()
  const copyFetcher = useFetcher<typeof action>()

  useEffect(() => {
    if (copyFetcher.state !== 'idle') return
    const d = copyFetcher.data
    if (
      !d ||
      typeof d !== 'object' ||
      !('intent' in d) ||
      d.intent !== INTENTS.copyInstallUrl ||
      !('installUrl' in d) ||
      typeof d.installUrl !== 'string'
    ) {
      return
    }
    void navigator.clipboard.writeText(d.installUrl).then(() => {
      toast.success('Install URL copied to clipboard')
      copyFetcher.reset()
    })
  }, [copyFetcher])

  const hasAnyLink = githubAppLinks.length > 0
  const needsReconnect = integration?.method === 'github_app' && !hasAnyLink

  const tokenNote = !integration?.hasToken ? (
    <p className="text-muted-foreground text-xs">
      ※ No personal access token is stored. After disconnecting all GitHub Apps,
      you will need to enter a token in the Integration settings.
    </p>
  ) : null

  return (
    <Stack gap="2" className="border-muted rounded-lg border p-4">
      <div className="space-y-1">
        <Label>GitHub App</Label>
        <p className="text-muted-foreground text-sm">
          Connect one or more GitHub accounts via the Upflow GitHub App.
        </p>
      </div>

      {hasAnyLink && (
        <Stack gap="2">
          {githubAppLinks.map((link) => (
            <InstallationCard key={link.installationId} link={link} />
          ))}
          <HStack className="flex-wrap">
            <Form method="POST">
              <input
                type="hidden"
                name="intent"
                value={INTENTS.installGithubApp}
              />
              <Button type="submit" size="sm" variant="outline">
                Add another GitHub account
              </Button>
            </Form>
          </HStack>
          {tokenNote}
        </Stack>
      )}

      {needsReconnect && (
        <Stack gap="2">
          <Alert>
            <AlertTitle>Reconnection required</AlertTitle>
            <AlertDescription>
              All GitHub App installations have been removed. Reinstall the app
              or switch back to a personal access token.
            </AlertDescription>
          </Alert>
          <HStack className="flex-wrap">
            <Form method="POST">
              <input
                type="hidden"
                name="intent"
                value={INTENTS.installGithubApp}
              />
              <Button type="submit" size="sm">
                Reinstall GitHub App
              </Button>
            </Form>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                revertFetcher.submit(
                  { intent: INTENTS.confirmRevertToToken },
                  { method: 'POST' },
                )
              }}
            >
              Revert to token
            </Button>
          </HStack>
          {tokenNote}
          <ConfirmDialog
            title="Revert to personal access token"
            desc="Disconnect the GitHub App flow and use a PAT again. You can reinstall the app later from this page."
            confirmText="Revert to token"
            destructive
            fetcher={revertFetcher}
          >
            <input type="hidden" name="intent" value={INTENTS.revertToToken} />
          </ConfirmDialog>
        </Stack>
      )}

      {!hasAnyLink && !needsReconnect && (
        <Stack gap="2">
          <HStack className="flex-wrap">
            <Form method="POST">
              <input
                type="hidden"
                name="intent"
                value={INTENTS.installGithubApp}
              />
              <Button type="submit" size="sm">
                Install GitHub App
              </Button>
            </Form>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={copyFetcher.state !== 'idle'}
              onClick={() => {
                copyFetcher.submit(
                  { intent: INTENTS.copyInstallUrl },
                  { method: 'POST' },
                )
              }}
            >
              Copy install URL
            </Button>
          </HStack>
        </Stack>
      )}
    </Stack>
  )
}

export const IntegrationSettings = ({
  integration,
  githubAppLinks,
}: IntegrationSettingsProps) => {
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === INTENTS.integrationSettings

  const hasAnyLink = githubAppLinks.length > 0
  const needsReconnect = integration?.method === 'github_app' && !hasAnyLink
  const showPatSection = !(integration?.method === 'github_app' && hasAnyLink)

  const integrationLastResult =
    actionData &&
    'intent' in actionData &&
    actionData.intent === INTENTS.integrationSettings &&
    'lastResult' in actionData
      ? actionData.lastResult
      : undefined

  const [form, { provider, method, privateToken }] = useForm<
    z.input<typeof schema>
  >({
    lastResult: integrationLastResult as SubmissionResult<string[]> | undefined,
    defaultValue: integration
      ? {
          provider: integration.provider,
          method: needsReconnect ? 'github_app' : 'token',
        }
      : { provider: 'github', method: 'token' },
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
  })

  return (
    <Stack gap="6">
      {showPatSection && (
        <Form method="POST" {...getFormProps(form)}>
          <input
            type="hidden"
            name="intent"
            value={INTENTS.integrationSettings}
          />
          <Stack>
            <fieldset className="space-y-1">
              <Label htmlFor={provider.id}>Provider</Label>
              <RadioGroup {...getInputProps(provider, { type: 'text' })}>
                <HStack>
                  <RadioGroupItem id="github" value="github" />
                  <Label htmlFor="github">
                    <HStack className="text-github gap-1">
                      <Github />
                      <span>GitHub</span>
                    </HStack>
                  </Label>
                </HStack>
              </RadioGroup>
              <div className="text-destructive">{provider.errors}</div>
            </fieldset>

            {needsReconnect ? (
              <input type="hidden" name="method" value="github_app" />
            ) : (
              <fieldset className="space-y-1">
                <Label htmlFor={method.id}>Method</Label>
                <RadioGroup {...getInputProps(method, { type: 'text' })}>
                  <HStack>
                    <RadioGroupItem id="token" value="token" />
                    <Label htmlFor="token">Personal access token</Label>
                  </HStack>
                </RadioGroup>
                <div className="text-destructive">{method.errors}</div>
              </fieldset>
            )}

            <fieldset className="space-y-1">
              <Label htmlFor={privateToken.id}>Private Token</Label>
              <Textarea
                {...getTextareaProps(privateToken)}
                placeholder={
                  integration?.hasToken
                    ? 'Token is set. Enter a new value to update.'
                    : undefined
                }
              />
              <div className="text-destructive">{privateToken.errors}</div>
            </fieldset>

            {form.errors && (
              <Alert variant="destructive">
                <AlertTitle>System Error</AlertTitle>
                <AlertDescription>{form.errors}</AlertDescription>
              </Alert>
            )}

            <div>
              <Button type="submit" loading={isSubmitting}>
                Update
              </Button>
            </div>
          </Stack>
        </Form>
      )}

      <GitHubAppSection
        integration={integration}
        githubAppLinks={githubAppLinks}
      />
    </Stack>
  )
}
