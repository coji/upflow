import { zx } from '@coji/zodix/v4'
import { createPatch } from 'diff'
import { useEffect, useMemo, useRef } from 'react'
import { href, useFetcher, useRevalidator } from 'react-router'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { Badge, Button, HStack, Heading, Stack } from '~/app/components/ui'
import { orgContext } from '~/app/middleware/context'
import {
  getGithubAppLink,
  getIntegration,
} from '~/app/services/github-integration-queries.server'
import { resolveOctokitFromOrg } from '~/app/services/github-octokit.server'
import {
  upsertPullRequest,
  upsertPullRequestReview,
  upsertPullRequestReviewers,
} from '~/batch/db/mutations'
import { getBotLogins } from '~/batch/db/queries'
import { createFetcher } from '~/batch/github/fetcher'
import type { ShapedGitHubPullRequest } from '~/batch/github/model'
import { buildPullRequests } from '~/batch/github/pullrequest'
import { createStore } from '~/batch/github/store'
import type { Route } from './+types/index'
import {
  getOrganizationSettings,
  getPullRequest,
  getPullRequestRawData,
  getPullRequestReviewers,
  getPullRequestReviews,
  getRepository,
  getShapedPullRequest,
} from './queries.server'

export const handle = {
  breadcrumb: (
    data: Awaited<ReturnType<typeof loader>>,
    params: { orgSlug: string; repository: string; pull: string },
  ) => ({
    label: `#${data.pull?.number}`,
    to: href('/:orgSlug/settings/repositories/:repository/:pull', {
      orgSlug: params.orgSlug,
      repository: params.repository,
      pull: params.pull,
    }),
  }),
}

export const loader = async ({ params, context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const { repository: repositoryId, pull: pullId } = zx.parseParams(params, {
    repository: z.string(),
    pull: zx.NumAsString,
  })

  const pull = await getPullRequest(organization.id, repositoryId, pullId)
  if (!pull) {
    throw new Response('Pull request not found', { status: 404 })
  }

  const [rawData, processedReviews, processedReviewers] = await Promise.all([
    getPullRequestRawData(organization.id, repositoryId, pullId),
    getPullRequestReviews(organization.id, repositoryId, pullId),
    getPullRequestReviewers(organization.id, repositoryId, pullId),
  ])

  return {
    pull,
    storeData: rawData
      ? {
          commits: rawData.commits as unknown[],
          reviews: rawData.reviews as unknown[],
          discussions: rawData.discussions as unknown[],
          timelineItems: (rawData.timelineItems ?? []) as unknown[],
        }
      : { commits: [], reviews: [], discussions: [], timelineItems: [] },
    processedReviews,
    processedReviewers,
  }
}

const intentSchema = z.enum(['compare', 'refresh'])

export const action = async ({
  request,
  params,
  context,
}: Route.ActionArgs) => {
  const { organization } = context.get(orgContext)
  const { repository: repositoryId, pull: pullId } = zx.parseParams(params, {
    repository: z.string(),
    pull: zx.NumAsString,
  })

  const formData = await request.formData()
  const intent = intentSchema.parse(formData.get('intent'))

  const [repository, integration, githubAppLink] = await Promise.all([
    getRepository(organization.id, repositoryId),
    getIntegration(organization.id),
    getGithubAppLink(organization.id),
  ])
  if (!repository) {
    throw new Response('Repository not found', { status: 404 })
  }
  if (repository.owner === null || repository.repo === null) {
    throw new Response('Repository is not properly configured', { status: 422 })
  }

  let octokit: ReturnType<typeof resolveOctokitFromOrg>
  try {
    octokit = resolveOctokitFromOrg({ integration, githubAppLink })
  } catch {
    throw new Response('GitHub integration is not configured', { status: 422 })
  }

  const fetcher = createFetcher({
    owner: repository.owner,
    repo: repository.repo,
    octokit,
  })

  return match(intent)
    .with('compare', async () => {
      const [commits, comments, reviews, timelineItems] = await Promise.all([
        fetcher.commits(pullId),
        fetcher.comments(pullId),
        fetcher.reviews(pullId),
        fetcher.timelineItems(pullId),
      ])
      return {
        intent: 'compare' as const,
        commits,
        comments,
        reviews,
        timelineItems,
      }
    })
    .with('refresh', async () => {
      // 1. Get existing PR shape from raw data
      const shapedPr = await getShapedPullRequest(
        organization.id,
        repositoryId,
        pullId,
      )
      if (!shapedPr) {
        throw new Response('Raw PR data not found. Run Compare first.', {
          status: 404,
        })
      }
      const pr = shapedPr as unknown as ShapedGitHubPullRequest

      // 2. Re-fetch commits/comments/reviews/timelineItems from GitHub
      const [commits, comments, reviews, timelineItems] = await Promise.all([
        fetcher.commits(pullId),
        fetcher.comments(pullId),
        fetcher.reviews(pullId),
        fetcher.timelineItems(pullId),
      ])

      // 3. Save raw data via store
      const store = createStore({
        organizationId: organization.id,
        repositoryId,
      })
      await store.savePrData(pr, {
        commits,
        reviews,
        discussions: comments,
        timelineItems,
      })

      // 4. Get organization settings and bot logins for build config
      const [settings, botLoginsList] = await Promise.all([
        getOrganizationSettings(organization.id),
        getBotLogins(organization.id),
      ])

      // 5. Build pull request data (analyze)
      const result = await buildPullRequests(
        {
          organizationId: organization.id,
          repositoryId,
          botLogins: new Set(botLoginsList),
          releaseDetectionMethod: settings?.releaseDetectionMethod ?? 'branch',
          releaseDetectionKey: settings?.releaseDetectionKey ?? '',
        },
        [pr],
        store.loader,
      )

      // 6. Upsert to DB
      for (const pull of result.pulls) {
        await upsertPullRequest(organization.id, pull)
      }
      for (const review of result.reviews) {
        await upsertPullRequestReview(organization.id, review)
      }
      for (const reviewer of result.reviewers) {
        await upsertPullRequestReviewers(
          organization.id,
          reviewer.repositoryId,
          reviewer.pullRequestNumber,
          reviewer.reviewers,
        )
      }

      return { intent: 'refresh' as const, success: true }
    })
    .exhaustive()
}

const UnifiedDiff = ({
  dbData,
  githubData,
  label,
}: {
  dbData: unknown[]
  githubData: unknown[]
  label: string
}) => {
  const patch = useMemo(
    () =>
      createPatch(
        label,
        JSON.stringify(dbData, null, 2),
        JSON.stringify(githubData, null, 2),
        'DB',
        'GitHub',
      ),
    [dbData, githubData, label],
  )

  return (
    <pre className="max-h-96 overflow-auto rounded border p-2 text-xs leading-relaxed">
      {patch.split('\n').map((line, i) => {
        let className = ''
        if (line.startsWith('+') && !line.startsWith('+++')) {
          className =
            'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          className =
            'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
        } else if (line.startsWith('@@')) {
          className = 'text-blue-600 dark:text-blue-400'
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: diff lines are static
          <div key={i} className={className}>
            {line}
          </div>
        )
      })}
    </pre>
  )
}

interface ComparisonSectionProps {
  title: string
  storeItems: unknown[]
  githubItems?: unknown[]
}

const ComparisonSection = ({
  title,
  storeItems,
  githubItems,
}: ComparisonSectionProps) => {
  const hasDiff =
    githubItems !== undefined &&
    JSON.stringify(storeItems) !== JSON.stringify(githubItems)

  return (
    <div className="space-y-2">
      <HStack>
        <Heading>{title}</Heading>
        <Badge variant="secondary">DB: {storeItems.length}</Badge>
        {githubItems !== undefined && (
          <>
            <Badge variant="secondary">GitHub: {githubItems.length}</Badge>
            {hasDiff ? (
              <Badge variant="destructive">差分あり</Badge>
            ) : (
              <Badge variant="outline">一致</Badge>
            )}
          </>
        )}
      </HStack>

      {githubItems !== undefined && hasDiff && (
        <UnifiedDiff
          dbData={storeItems}
          githubData={githubItems}
          label={title}
        />
      )}

      <details>
        <summary className="text-muted-foreground cursor-pointer text-sm">
          DB data (JSON)
        </summary>
        <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs">
          {JSON.stringify(storeItems, null, 2)}
        </pre>
      </details>

      {githubItems !== undefined && (
        <details>
          <summary className="text-muted-foreground cursor-pointer text-sm">
            GitHub data (JSON)
          </summary>
          <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs">
            {JSON.stringify(githubItems, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

const RepositoryPullsIndexPage = ({
  loaderData: { pull, storeData, processedReviews, processedReviewers },
}: Route.ComponentProps) => {
  const compareFetcher = useFetcher<typeof action>()
  const refreshFetcher = useFetcher<typeof action>()
  const revalidator = useRevalidator()

  const isComparing =
    compareFetcher.state !== 'idle' &&
    compareFetcher.formData?.get('intent') === 'compare'
  const isRefreshing =
    refreshFetcher.state !== 'idle' &&
    refreshFetcher.formData?.get('intent') === 'refresh'

  const compareData =
    compareFetcher.data?.intent === 'compare' ? compareFetcher.data : undefined

  const refreshData =
    refreshFetcher.data?.intent === 'refresh' ? refreshFetcher.data : undefined

  // Revalidate loader data after successful refresh (once)
  const lastRefreshRef = useRef<typeof refreshData>(undefined)
  useEffect(() => {
    if (refreshData?.success && refreshData !== lastRefreshRef.current) {
      lastRefreshRef.current = refreshData
      revalidator.revalidate()
    }
  }, [refreshData, revalidator])

  return (
    <Stack gap="6">
      <div className="space-y-1">
        <Heading>Pull Request Details</Heading>
        <details>
          <summary className="text-muted-foreground cursor-pointer text-sm">
            Raw PR data (JSON)
          </summary>
          <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs">
            {JSON.stringify(pull, null, 2)}
          </pre>
        </details>
      </div>

      <HStack>
        <compareFetcher.Form method="post">
          <input type="hidden" name="intent" value="compare" />
          <Button type="submit" disabled={isComparing || isRefreshing}>
            {isComparing ? 'Fetching from GitHub...' : 'Compare with GitHub'}
          </Button>
        </compareFetcher.Form>

        <refreshFetcher.Form method="post">
          <input type="hidden" name="intent" value="refresh" />
          <Button
            type="submit"
            variant="secondary"
            disabled={isComparing || isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh (Re-fetch & Save)'}
          </Button>
        </refreshFetcher.Form>

        {refreshData?.success && <Badge variant="default">Refreshed</Badge>}
      </HStack>

      <Stack gap="4">
        <Heading>Raw Data (githubRawData)</Heading>
        <ComparisonSection
          title="Commits"
          storeItems={storeData.commits}
          githubItems={compareData?.commits}
        />
        <ComparisonSection
          title="Reviews"
          storeItems={storeData.reviews}
          githubItems={compareData?.reviews}
        />
        <ComparisonSection
          title="Discussions"
          storeItems={storeData.discussions}
          githubItems={compareData?.comments}
        />
        <ComparisonSection
          title="Timeline Items"
          storeItems={storeData.timelineItems}
          githubItems={compareData?.timelineItems}
        />
      </Stack>

      <Stack gap="4">
        <Heading>Processed Data</Heading>
        <div className="space-y-2">
          <HStack>
            <Heading>Pull Request Reviews</Heading>
            <Badge variant="secondary">{processedReviews.length}件</Badge>
          </HStack>
          <details>
            <summary className="text-muted-foreground cursor-pointer text-sm">
              pullRequestReviews (JSON)
            </summary>
            <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs">
              {JSON.stringify(processedReviews, null, 2)}
            </pre>
          </details>
        </div>

        <div className="space-y-2">
          <HStack>
            <Heading>Pull Request Reviewers</Heading>
            <Badge variant="secondary">{processedReviewers.length} 件</Badge>
          </HStack>
          <details>
            <summary className="text-muted-foreground cursor-pointer text-sm">
              pullRequestReviewers (JSON)
            </summary>
            <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs">
              {JSON.stringify(processedReviewers, null, 2)}
            </pre>
          </details>
        </div>
      </Stack>
    </Stack>
  )
}
export default RepositoryPullsIndexPage
