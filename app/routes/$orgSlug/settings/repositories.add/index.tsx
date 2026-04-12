import { zx } from '@coji/zodix/v4'
import { parseWithZod } from '@conform-to/zod/v4'
import { ChevronRightIcon, ChevronsLeftIcon, RefreshCwIcon } from 'lucide-react'
import {
  Form,
  href,
  isRouteErrorResponse,
  redirect,
  useRouteError,
  useSearchParams,
} from 'react-router'
import { dataWithError, dataWithSuccess } from 'remix-toast'
import { z } from 'zod'
import {
  Alert,
  AlertDescription,
  Button,
  HStack,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
} from '~/app/components/ui'
import { requireOrgOwner } from '~/app/libs/auth.server'
import { getErrorMessage } from '~/app/libs/error-message'
import { captureExceptionToSentry } from '~/app/libs/sentry-node.server'
import { orgContext } from '~/app/middleware/context'
import { clearOrgCache, getOrgCachedData } from '~/app/services/cache.server'
import { durably } from '~/app/services/durably.server'
import {
  assertInstallationBelongsToOrg,
  getActiveInstallationOptions,
} from '~/app/services/github-integration-queries.server'
import { resolveOctokitForInstallation } from '~/app/services/github-octokit.server'
import { crawlRepoConcurrencyKey } from '~/app/services/jobs/concurrency-keys.server'
import type { OrganizationId } from '~/app/types/organization'
import ContentSection from '../+components/content-section'
import { RepositoryItem, RepositoryList } from './+components'
import {
  extractOwners,
  fetchAllInstallationRepos,
  filterInstallationRepos,
  type TaggedInstallationRepo,
} from './+functions/get-installation-repos'
import type { Repository } from './+functions/get-repositories-by-owner-and-keyword'
import { getRepositoriesByOwnerAndKeyword } from './+functions/get-repositories-by-owner-and-keyword'
import { getUniqueOwners } from './+functions/get-unique-owners'
import { addRepository } from './+functions/mutations.server'
import { getIntegrationWithRepositories } from './+functions/queries.server'
import type { Route } from './+types/index'

export const handle = { breadcrumb: () => ({ label: 'Add Repositories' }) }

const AddRepoSchema = z.object({
  owner: z.string().trim().min(1),
  name: z.string().trim().min(1),
  installationId: z.coerce.number().int().positive().optional(),
})

type IntegrationWithRepositories = NonNullable<
  Awaited<ReturnType<typeof getIntegrationWithRepositories>>
>

type AddRepositoriesLoaderData = {
  registeredRepos: IntegrationWithRepositories['repositories']
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
  query: string
  owner: string | undefined
  owners: string[]
  repos: Repository[]
  isGithubAppRepos: boolean
  /** Number of active installations whose appRepositorySelection is `'selected'`. */
  selectedInstallationCount: number
  /** Total number of active installations queried. */
  totalInstallationCount: number
  /** Installations whose repository fetch failed (so the UI can warn). */
  failedInstallationIds: number[]
}

async function loadReposForToken(
  integration: IntegrationWithRepositories,
  organizationId: OrganizationId,
  owner: string | undefined,
  cursor: string | undefined,
  query: string,
): Promise<AddRepositoriesLoaderData> {
  const token = integration.privateToken
  if (!token) {
    throw new Error('integration not configured')
  }
  const registeredOwners = [
    ...new Set(integration.repositories.map((r) => r.owner)),
  ]
  const apiOwners = await getOrgCachedData(
    organizationId,
    'owners',
    () => getUniqueOwners(token),
    300000,
  )
  const owners = [...new Set([...apiOwners, ...registeredOwners])].sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
  if (owner && !owners.includes(owner)) {
    throw new Error('invalid owner')
  }

  const { pageInfo, repos } = await getOrgCachedData(
    organizationId,
    `repos-${owner}-${cursor}-${query}`,
    () =>
      getRepositoriesByOwnerAndKeyword({
        token,
        cursor,
        owner,
        keyword: query,
      }),
    300000,
  )

  return {
    registeredRepos: integration.repositories,
    pageInfo,
    query,
    owner,
    owners,
    repos,
    isGithubAppRepos: false,
    selectedInstallationCount: 0,
    totalInstallationCount: 0,
    failedInstallationIds: [],
  }
}

async function loadReposForApp(
  integration: IntegrationWithRepositories,
  organizationId: OrganizationId,
  owner: string | undefined,
  query: string,
): Promise<AddRepositoriesLoaderData> {
  const installationOptions = await getActiveInstallationOptions(organizationId)
  if (installationOptions.length === 0) {
    throw new Error('GitHub App is not connected')
  }

  // Fetch every installation's visible repositories in parallel.
  // Use allSettled so a transient failure on one installation (e.g. revoked
  // token mid-request) doesn't blank out the entire Add UI.
  const settled = await Promise.allSettled(
    installationOptions.map(async (link) => {
      const octokit = resolveOctokitForInstallation(link.installationId)
      const repos = await getOrgCachedData(
        organizationId,
        `app-installation-all-repos:${link.installationId}`,
        () => fetchAllInstallationRepos(octokit),
        300000,
      )
      return repos.map(
        (repo): TaggedInstallationRepo => ({
          installationId: link.installationId,
          repo,
        }),
      )
    }),
  )
  const failedInstallationIds: number[] = []
  // Dedupe by `owner/repo`. The createdAt-asc order from
  // getActiveInstallationOptions makes the *oldest* active installation win,
  // which keeps the canonical attribution stable across page reloads. The
  // membership table is the source of truth for "which installations can
  // see this repo" so this UI choice does not affect crawl correctness.
  const seen = new Set<string>()
  const allTagged: TaggedInstallationRepo[] = []
  settled.forEach((result, index) => {
    if (result.status === 'rejected') {
      failedInstallationIds.push(installationOptions[index].installationId)
      return
    }
    for (const tagged of result.value) {
      const key = `${tagged.repo.owner.login}/${tagged.repo.name}`
      if (seen.has(key)) continue
      seen.add(key)
      allTagged.push(tagged)
    }
  })

  const registeredOwners = [
    ...new Set(integration.repositories.map((r) => r.owner)),
  ]
  const apiOwners = extractOwners(allTagged)
  const owners = [...new Set([...apiOwners, ...registeredOwners])].sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
  // Only reject an unknown owner when every installation's repo list
  // resolved successfully. If any installation failed, the owner may
  // legitimately belong to the missing set — degrade gracefully instead
  // of crashing the page.
  if (owner && !owners.includes(owner) && failedInstallationIds.length === 0) {
    throw new Error('invalid owner')
  }

  const repos = filterInstallationRepos(allTagged, owner, query)
  const selectedInstallationCount = installationOptions.filter(
    (l) => l.appRepositorySelection === 'selected',
  ).length

  return {
    registeredRepos: integration.repositories,
    pageInfo: { hasNextPage: false as const, endCursor: null as null },
    query,
    owner,
    owners,
    repos,
    isGithubAppRepos: true,
    selectedInstallationCount,
    totalInstallationCount: installationOptions.length,
    failedInstallationIds,
  }
}

export const loader = async ({
  request,
  params,
  context,
}: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)
  requireOrgOwner(membership, organization.slug)
  const { owner, cursor, query, refresh } = zx.parseQuery(request, {
    owner: z.string().optional(),
    cursor: z.string().optional(),
    query: z.string().optional().default(''),
    refresh: z.string().optional(),
  })

  if (refresh) {
    const searchParams = new URL(request.url).searchParams
    searchParams.delete('refresh')
    clearOrgCache(organization.id)
    throw redirect(
      `${href('/:orgSlug/settings/repositories/add', { orgSlug: params.orgSlug })}?${searchParams.toString()}`,
    )
  }

  const integration = await getIntegrationWithRepositories(organization.id)
  if (!integration) {
    throw new Error('integration not created')
  }

  if (integration.method === 'github_app') {
    return loadReposForApp(integration, organization.id, owner, query)
  }

  return loadReposForToken(integration, organization.id, owner, cursor, query)
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { organization, membership } = context.get(orgContext)
  requireOrgOwner(membership, organization.slug)
  const integration = await getIntegrationWithRepositories(organization.id)
  if (!integration) {
    throw new Error('integration not created')
  }

  const submission = parseWithZod(await request.formData(), {
    schema: AddRepoSchema,
  })
  if (submission.status !== 'success') {
    return dataWithError({}, { message: 'Invalid form submission' })
  }

  let installationId: number | null = null
  if (integration.method === 'github_app') {
    if (submission.value.installationId === undefined) {
      return dataWithError(
        {},
        { message: 'Installation id is required for GitHub App mode' },
      )
    }
    try {
      await assertInstallationBelongsToOrg(
        organization.id,
        submission.value.installationId,
      )
    } catch (e) {
      return dataWithError(
        {},
        {
          message: getErrorMessage(e),
        },
      )
    }
    // Defend against tampered hidden inputs: confirm the installation can
    // actually see (owner, name) before inserting. `installationId` alone
    // isn't enough — a malicious form submit could pair a valid org-owned
    // installation with a repo from a different installation.
    let visibleRepos: Awaited<ReturnType<typeof fetchAllInstallationRepos>>
    try {
      const octokit = resolveOctokitForInstallation(
        submission.value.installationId,
      )
      visibleRepos = await getOrgCachedData(
        organization.id,
        `app-installation-all-repos:${submission.value.installationId}`,
        () => fetchAllInstallationRepos(octokit),
        300000,
      )
    } catch (e) {
      console.error('Failed to verify installation access:', e)
      captureExceptionToSentry(e, {
        tags: {
          component: 'repositories.add',
          operation: 'visibility.check',
        },
        extra: {
          organizationId: organization.id,
          installationId: submission.value.installationId,
        },
      })
      return dataWithError(
        {},
        {
          message:
            'Could not verify the selected installation. Please try again.',
        },
      )
    }
    const canAccessRepo = visibleRepos.some(
      (repo) =>
        repo.owner.login === submission.value.owner &&
        repo.name === submission.value.name,
    )
    if (!canAccessRepo) {
      return dataWithError(
        {},
        { message: 'Selected installation cannot access this repository' },
      )
    }
    installationId = submission.value.installationId
  }

  const inserted = await addRepository(organization.id, {
    owner: submission.value.owner,
    repo: submission.value.name,
    githubInstallationId: installationId,
  }).catch((e) => {
    console.error('Failed to add repository:', e)
    return null
  })
  if (!inserted) {
    return dataWithError(
      {},
      { message: 'Failed to add repository. Please try again.' },
    )
  }
  if (inserted.membershipUpsertFailed) {
    captureExceptionToSentry(
      new Error('addRepository: membership upsert failed'),
      {
        tags: { component: 'repositories.add', operation: 'membership.upsert' },
        extra: {
          organizationId: organization.id,
          repositoryId: inserted.id,
          installationId,
        },
      },
    )
  }

  // Fire-and-forget: kick off an initial crawl so existing PRs appear without
  // waiting for the hourly scheduled job. Failures must not fail the add.
  durably.jobs.crawl
    .trigger(
      {
        organizationId: organization.id,
        refresh: false,
        repositoryId: inserted.id,
      },
      {
        concurrencyKey: crawlRepoConcurrencyKey(organization.id, inserted.id),
        labels: { organizationId: organization.id },
        coalesce: 'skip',
      },
    )
    .catch((e) => {
      captureExceptionToSentry(e, {
        tags: { component: 'repositories.add', operation: 'crawl.trigger' },
        extra: {
          organizationId: organization.id,
          repositoryId: inserted.id,
        },
      })
    })

  return dataWithSuccess(
    {},
    {
      message: `Repository added: ${submission.value.owner}/${submission.value.name}`,
    },
  )
}

export default function AddRepositoryPage({
  loaderData: {
    registeredRepos,
    pageInfo,
    query,
    owner,
    owners,
    repos,
    isGithubAppRepos,
    selectedInstallationCount,
    totalInstallationCount,
    failedInstallationIds,
  },
}: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const allInstallationsAreSelected =
    totalInstallationCount > 0 &&
    selectedInstallationCount === totalInstallationCount
  const someInstallationsAreSelected =
    selectedInstallationCount > 0 && !allInstallationsAreSelected

  return (
    <ContentSection
      title="Add Repositories"
      desc="Add repositories to the organization."
      fullWidth
    >
      <Stack>
        {failedInstallationIds.length > 0 ? (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load repositories from {failedInstallationIds.length}{' '}
              installation(s). The list below may be incomplete. Try refreshing
              or check the GitHub App settings.
            </AlertDescription>
          </Alert>
        ) : null}

        {allInstallationsAreSelected ? (
          <Alert>
            <AlertDescription>
              Only repositories selected in the GitHub App settings are shown.
              You can change which repositories are included in the GitHub App
              settings on GitHub.
            </AlertDescription>
          </Alert>
        ) : someInstallationsAreSelected ? (
          <Alert>
            <AlertDescription>
              Some of your GitHub App installations only expose selected
              repositories. Repositories from those installations may be missing
              from this list — adjust the selection in the GitHub App settings
              if needed.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-end justify-between gap-2">
          <fieldset className="flex flex-1 flex-col gap-1">
            <Label>Organization</Label>
            <Select
              defaultValue={owner}
              onValueChange={(value) => {
                setSearchParams(
                  (prev) => {
                    prev.set('owner', value)
                    prev.delete('cursor')
                    prev.delete('query')
                    prev.delete('refresh')
                    return prev
                  },
                  {
                    preventScrollReset: true,
                  },
                )
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select organization..." />
              </SelectTrigger>
              <SelectContent>
                {owners.map((owner) => (
                  <SelectItem key={owner} value={owner}>
                    {owner}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
          <Form method="get">
            {/* 既存のURLパラメタをすべてつける */}
            {[...searchParams.entries()].map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <input type="hidden" name="refresh" value="true" />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label="Refresh repository list"
            >
              <RefreshCwIcon className="text-muted-foreground scale-70" />
            </Button>
          </Form>
        </div>

        <Form
          method="get"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            const query = formData.get('query') as string
            setSearchParams(
              (prev) => {
                prev.set('query', query)
                prev.delete('cursor')
                prev.delete('refresh')
                return prev
              },
              {
                preventScrollReset: true,
              },
            )
          }}
        >
          <HStack>
            <Input
              name="query"
              type="search"
              placeholder="Search repositories..."
              defaultValue={query}
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </HStack>
        </Form>

        <RepositoryList>
          {repos.length === 0 ? (
            <div className="text-muted-foreground p-4 text-center text-sm">
              No repositories found
            </div>
          ) : (
            repos.map((repo, index) => (
              <RepositoryItem
                key={repo.id}
                repo={repo}
                isAdded={registeredRepos.some(
                  (r) => r.owner === repo.owner && r.repo === repo.name,
                )}
                isLast={index === repos.length - 1}
                installationId={repo.installationId}
              />
            ))
          )}
        </RepositoryList>

        {!isGithubAppRepos ? (
          <HStack>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={searchParams.get('cursor') === null}
              onClick={() => {
                setSearchParams(
                  (prev) => {
                    prev.delete('cursor')
                    prev.delete('refresh')
                    return prev
                  },
                  {
                    preventScrollReset: true,
                  },
                )
              }}
            >
              <ChevronsLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!pageInfo.hasNextPage}
              onClick={() => {
                setSearchParams(
                  (prev) => {
                    if (pageInfo.endCursor) {
                      prev.set('cursor', pageInfo.endCursor)
                    } else {
                      prev.delete('cursor')
                    }
                    prev.delete('refresh')
                    return prev
                  },
                  {
                    preventScrollReset: true,
                  },
                )
              }}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </HStack>
        ) : null}
      </Stack>
    </ContentSection>
  )
}

export const ErrorBoundary = () => {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </main>
    )
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Error!</h1>
      <p>
        {error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Unknown error'}
      </p>
    </main>
  )
}
