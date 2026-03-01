import { zx } from '@coji/zodix/v4'
import { createPatch } from 'diff'
import { useMemo } from 'react'
import { useFetcher } from 'react-router'
import { z } from 'zod'
import { Badge, Button, HStack, Heading, Stack } from '~/app/components/ui'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import { createFetcher } from '~/batch/provider/github/fetcher'
import type { Route } from './+types/index'
import {
  getPullRequest,
  getPullRequestRawData,
  getRepositoryWithIntegration,
} from './queries.server'

export const handle = {
  breadcrumb: (
    data: Awaited<ReturnType<typeof loader>>,
    params: { orgSlug: string; repository: string; pull: string },
  ) => ({
    label: `#${data.pull?.number}`,
    to: `/${params.orgSlug}/settings/repositories/${params.repository}/${params.pull}`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const { repository: repositoryId, pull: pullId } = zx.parseParams(params, {
    repository: z.string(),
    pull: zx.NumAsString,
  })

  const pull = await getPullRequest(organization.id, repositoryId, pullId)
  if (!pull) {
    throw new Response('Pull request not found', { status: 404 })
  }

  const rawData = await getPullRequestRawData(
    organization.id,
    repositoryId,
    pullId,
  )

  return {
    pull,
    storeData: rawData
      ? {
          commits: rawData.commits as unknown[],
          reviews: rawData.reviews as unknown[],
          discussions: rawData.discussions as unknown[],
        }
      : { commits: [], reviews: [], discussions: [] },
  }
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const { repository: repositoryId, pull: pullId } = zx.parseParams(params, {
    repository: z.string(),
    pull: zx.NumAsString,
  })

  const repository = await getRepositoryWithIntegration(
    organization.id,
    repositoryId,
  )
  if (!repository) {
    throw new Response('Repository not found', { status: 404 })
  }
  if (
    repository.owner === null ||
    repository.repo === null ||
    repository.integration === null ||
    repository.integration.privateToken === null
  ) {
    throw new Error('Repository is not integrated')
  }

  const fetcher = createFetcher({
    owner: repository.owner,
    repo: repository.repo,
    token: repository.integration.privateToken,
  })

  const [commits, comments, reviews] = await Promise.all([
    fetcher.commits(pullId),
    fetcher.comments(pullId),
    fetcher.reviews(pullId),
  ])

  return { commits, comments, reviews }
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
  loaderData: { pull, storeData },
}: Route.ComponentProps) => {
  const compareFetcher = useFetcher<typeof action>()
  const isComparing = compareFetcher.state !== 'idle'
  const githubData = compareFetcher.data

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

      <div>
        <compareFetcher.Form method="post">
          <Button type="submit" disabled={isComparing}>
            {isComparing ? 'Fetching from GitHub...' : 'Compare with GitHub'}
          </Button>
        </compareFetcher.Form>
      </div>

      <Stack gap="4">
        <ComparisonSection
          title="Commits"
          storeItems={storeData.commits}
          githubItems={githubData?.commits}
        />
        <ComparisonSection
          title="Reviews"
          storeItems={storeData.reviews}
          githubItems={githubData?.reviews}
        />
        <ComparisonSection
          title="Discussions"
          storeItems={storeData.discussions}
          githubItems={githubData?.comments}
        />
      </Stack>
    </Stack>
  )
}
export default RepositoryPullsIndexPage
