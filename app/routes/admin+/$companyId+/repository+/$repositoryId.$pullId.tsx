import { json, type LoaderArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { z } from 'zod'
import { zx } from 'zodix'
import { Heading, HStack, Stack } from '~/app/components/ui'
import { getPullRequest } from '~/app/models/admin/pull-requests.server'
import { getRepository } from '~/app/models/admin/repository.server'
import { createFetcher } from '~/batch/provider/github/fetcher'
import { createStore } from '~/batch/provider/github/store'

export const handle = {
  breadcrumb: ({
    companyId,
    repositoryId,
    pull,
  }: {
    companyId: string
    repositoryId: string
    pull: Awaited<ReturnType<typeof getPullRequest>>
  }) => ({
    label: pull?.number,
    to: `/admin/${companyId}/repository/${repositoryId}/${pull.number}`,
  }),
}

export const loader = async ({ request, params }: LoaderArgs) => {
  const { companyId, repositoryId, pullId } = zx.parseParams(params, {
    companyId: z.string(),
    repositoryId: z.string(),
    pullId: zx.NumAsString,
  })

  const repository = await getRepository(repositoryId)
  if (!repository) {
    throw new Error('Repository not found')
  }

  const pull = await getPullRequest(pullId)
  const store = createStore({ companyId, repositoryId })
  const storeData = {
    commits: await store.loader.commits(pullId),
    comments: await store.loader.discussions(pullId),
    reviews: await store.loader.reviews(pullId),
  }

  invariant(repository.owner, 'Repository is not integrated')
  invariant(repository.repo, 'Repository is not integrated')
  invariant(repository.integration, 'Repository is not integrated')
  invariant(repository.integration.privateToken, 'Repository is not integrated')

  const fetcher = createFetcher({
    owner: repository.owner,
    repo: repository.repo,
    token: repository.integration.privateToken,
  })
  const fetchData = {
    commits: await fetcher.commits(pullId),
    comments: await fetcher.comments(pullId),
    reviews: await fetcher.reviews(pullId),
  }

  return json({ companyId, repositoryId, pull, storeData, fetchData })
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
