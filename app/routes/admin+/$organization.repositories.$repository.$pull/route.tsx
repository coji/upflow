import { href } from 'react-router'
import { z } from 'zod'
import { zx } from 'zodix'
import { HStack, Heading, Stack } from '~/app/components/ui'
import { createFetcher } from '~/batch/provider/github/fetcher'
import { createStore } from '~/batch/provider/github/store'
import type { Route } from './+types/route'
import { getPullRequest, getRepository } from './queries.server'

export const handle = {
  breadcrumb: ({
    organizationId,
    repositoryId,
    pull,
  }: Awaited<ReturnType<typeof loader>>) => ({
    label: pull?.number,
    to: href('/admin/:organization/repositories/:repository/:pull', {
      organization: organizationId,
      repository: repositoryId,
      pull: String(pull.number),
    }),
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const {
    organization: organizationId,
    repository: repositoryId,
    pull: pullId,
  } = zx.parseParams(params, {
    organization: z.string(),
    repository: z.string(),
    pull: zx.NumAsString,
  })

  const repository = await getRepository(repositoryId)
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

  const pull = await getPullRequest(repository.id, pullId)
  if (!pull) {
    throw new Response('Pull request not found', { status: 404 })
  }

  const store = createStore({ organizationId, repositoryId })
  const storeData = {
    commits: await store.loader.commits(pullId),
    comments: await store.loader.discussions(pullId),
    reviews: await store.loader.reviews(pullId),
  }

  const fetcher = createFetcher({
    owner: repository.owner,
    repo: repository.repo,
    token: repository.integration.privateToken,
    delay: 500,
  })
  const fetchData = {
    commits: await fetcher.commits(pullId),
    comments: await fetcher.comments(pullId),
    reviews: await fetcher.reviews(pullId),
  }

  return {
    organizationId,
    repositoryId,
    repository,
    pull,
    storeData,
    fetchData,
  }
}

const RepositoryPullsIndexPage = ({
  loaderData: { pull, storeData, fetchData },
}: Route.ComponentProps) => {
  return (
    <Stack>
      <div>
        <Heading>Pull Request Details</Heading>
        <pre>{JSON.stringify(pull, null, 2)}</pre>
      </div>

      <HStack>
        <Stack>
          <Heading>Store</Heading>
          <div>
            <Heading>ReviewComments</Heading>
            <pre>{JSON.stringify(storeData.comments, null, 2)}</pre>
          </div>

          <div>
            <Heading>Review</Heading>
            <pre>{JSON.stringify(storeData.reviews, null, 2)}</pre>
          </div>

          <div>
            <Heading>Commits</Heading>
            <pre>{JSON.stringify(storeData.commits, null, 2)}</pre>
          </div>
        </Stack>

        <Stack>
          <Heading>Fetch</Heading>
          <div>
            <Heading>ReviewComments (live)</Heading>
            <pre>{JSON.stringify(fetchData.comments, null, 2)}</pre>
          </div>

          <div>
            <Heading>Reviews (live)</Heading>
            <pre>{JSON.stringify(fetchData.reviews, null, 2)}</pre>
          </div>

          <div>
            <Heading>Commits (live)</Heading>
            <pre>{JSON.stringify(fetchData.commits, null, 2)}</pre>
          </div>
        </Stack>
      </HStack>
    </Stack>
  )
}
export default RepositoryPullsIndexPage
