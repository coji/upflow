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
import { INTENTS, integrationSettingsSchema as schema } from '../+schema'
import type { action } from '../../integration/index'

export interface IntegrationSettingsProps {
  integration?: {
    provider: string
    method: 'token' | 'github_app'
    hasToken: boolean
    appSuspendedAt: string | null
  }
  githubAppLink: {
    githubOrg: string
    appRepositorySelection: 'all' | 'selected'
  } | null
}

function GitHubAppSection({
  integration,
  githubAppLink,
}: Pick<IntegrationSettingsProps, 'integration' | 'githubAppLink'>) {
  const disconnectFetcher = useFetcher<ConfirmDialogData>()
  const revertFetcher = useFetcher<ConfirmDialogData>()
  const copyFetcher = useFetcher<typeof action>()

  useEffect(() => {
    if (copyFetcher.state !== 'idle') return
    const d = copyFetcher.data
    if (
      !d ||
      typeof d !== 'object' ||
      !('intent' in d) ||
      d.intent !== 'copy-install-url' ||
      !('installUrl' in d) ||
      typeof d.installUrl !== 'string'
    ) {
      return
    }
    void navigator.clipboard.writeText(d.installUrl).then(() => {
      toast.success('Install URL copied to clipboard')
      copyFetcher.reset()
    })
  }, [copyFetcher.data, copyFetcher.reset, copyFetcher.state])

  const isAppConnected =
    integration?.method === 'github_app' &&
    githubAppLink != null &&
    !integration.appSuspendedAt
  const isAppSuspended =
    integration?.method === 'github_app' &&
    githubAppLink != null &&
    !!integration.appSuspendedAt
  const needsReconnect =
    integration?.method === 'github_app' && githubAppLink == null

  const githubInstallationsSettingsUrl = githubAppLink
    ? `https://github.com/orgs/${encodeURIComponent(githubAppLink.githubOrg)}/settings/installations`
    : null

  const tokenNote = !integration?.hasToken ? (
    <p className="text-muted-foreground text-xs">
      ※ No personal access token is stored. After switching, you will need to
      enter a token in the Integration settings.
    </p>
  ) : null

  return (
    <Stack gap="2" className="border-muted rounded-lg border p-4">
      <div className="space-y-1">
        <Label>GitHub App</Label>
        <p className="text-muted-foreground text-sm">
          Connect with the Upflow GitHub App instead of a personal access token.
        </p>
      </div>

      {isAppConnected && githubAppLink && (
        <Stack gap="2">
          <p className="text-sm">
            Connected to GitHub organization{' '}
            <span className="font-medium">{githubAppLink.githubOrg}</span>
            {githubAppLink.appRepositorySelection === 'selected' ? (
              <span className="text-muted-foreground">
                {' '}
                (selected repositories only)
              </span>
            ) : null}
          </p>
          <HStack className="flex-wrap">
            {githubInstallationsSettingsUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={githubInstallationsSettingsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLinkIcon className="mr-1 h-4 w-4" />
                  GitHub App settings
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                disconnectFetcher.submit(
                  { intent: 'confirm-disconnect-github-app' },
                  { method: 'POST' },
                )
              }}
            >
              Disconnect
            </Button>
          </HStack>
          {tokenNote}
        </Stack>
      )}

      {isAppSuspended && githubAppLink && githubInstallationsSettingsUrl && (
        <Stack gap="2">
          <Alert variant="destructive">
            <AlertTitle>Suspended</AlertTitle>
            <AlertDescription>
              GitHub has suspended this installation. Unsuspend it in GitHub to
              resume syncing.
            </AlertDescription>
          </Alert>
          <p className="text-sm">
            Organization:{' '}
            <span className="font-medium">{githubAppLink.githubOrg}</span>
          </p>
          <Button variant="outline" size="sm" asChild>
            <a
              href={githubInstallationsSettingsUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLinkIcon className="mr-1 h-4 w-4" />
              Open GitHub App settings
            </a>
          </Button>
          <HStack className="flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                disconnectFetcher.submit(
                  { intent: 'confirm-disconnect-github-app' },
                  { method: 'POST' },
                )
              }}
            >
              Disconnect
            </Button>
          </HStack>
          {tokenNote}
        </Stack>
      )}

      {/* Shared disconnect dialog for connected + suspended states */}
      {(isAppConnected || isAppSuspended) && (
        <ConfirmDialog
          title="Disconnect GitHub App"
          desc="The organization will use a personal access token for GitHub API access again. You can reconnect the app at any time."
          confirmText="Disconnect"
          destructive
          fetcher={disconnectFetcher}
        >
          <input type="hidden" name="intent" value="disconnect-github-app" />
        </ConfirmDialog>
      )}

      {needsReconnect && (
        <Stack gap="2">
          <Alert>
            <AlertTitle>Reconnection required</AlertTitle>
            <AlertDescription>
              The GitHub App was uninstalled or the link was removed. Reinstall
              the app or switch back to a personal access token.
            </AlertDescription>
          </Alert>
          <HStack className="flex-wrap">
            <Form method="POST">
              <input type="hidden" name="intent" value="install-github-app" />
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
                  { intent: 'confirm-revert-to-token' },
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
            <input type="hidden" name="intent" value="revert-to-token" />
          </ConfirmDialog>
        </Stack>
      )}

      {!isAppConnected && !isAppSuspended && !needsReconnect && (
        <Stack gap="2">
          <HStack className="flex-wrap">
            <Form method="POST">
              <input type="hidden" name="intent" value="install-github-app" />
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
                  { intent: 'copy-install-url' },
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
  githubAppLink,
}: IntegrationSettingsProps) => {
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === INTENTS.integrationSettings

  const needsReconnect =
    integration?.method === 'github_app' && githubAppLink == null
  const showPatSection = !(
    integration?.method === 'github_app' && githubAppLink != null
  )

  const integrationSubmission =
    actionData &&
    'intent' in actionData &&
    actionData.intent === INTENTS.integrationSettings
      ? actionData
      : undefined

  const [form, { provider, method, privateToken }] = useForm({
    lastResult: integrationSubmission?.lastResult,
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
        githubAppLink={githubAppLink}
      />
    </Stack>
  )
}
