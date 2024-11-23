import type { LoaderFunctionArgs } from 'react-router'
import { useLoaderData } from 'react-router'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import { HStack, Heading, Stack } from '~/app/components/ui'
import { createFetcher } from '~/batch/provider/github/fetcher'
import { createStore } from '~/batch/provider/github/store'
import { getPullRequest, getRepository } from './queries.server'

export const handle = {
  breadcrumb: ({
    companyId,
    repositoryId,
    pull,
  }: {
    companyId: string
    repositoryId: string
    repository: Awaited<ReturnType<typeof getRepository>>
    pull: NonNullable<Awaited<ReturnType<typeof getPullRequest>>>
  }) => ({
    label: pull?.number,
    to: $path('/admin/:company/repositories/:repository/:pull', {
      company: companyId,
      repository: repositoryId,
      pull: pull.number,
    }),
  }),
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const {
    company: companyId,
    repository: repositoryId,
    pull: pullId,
  } = zx.parseParams(params, {
    company: z.string(),
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

  const store = createStore({ companyId, repositoryId })
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
    companyId,
    repositoryId,
    repository,
    pull,
    storeData,
    fetchData,
  }
}

const RepositoryPullsIndexPage = () => {
  const { pull, storeData, fetchData } = useLoaderData<typeof loader>()

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
