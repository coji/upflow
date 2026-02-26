import { zx } from '@coji/zodix/v4'
import { z } from 'zod'
import { HStack, Heading, Stack } from '~/app/components/ui'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import { createFetcher } from '~/batch/provider/github/fetcher'
import { createStore } from '~/batch/provider/github/store'
import type { Route } from './+types/index'
import { getPullRequest, getRepository } from './queries.server'

export const handle = {
  breadcrumb: (
    data: Awaited<ReturnType<typeof loader>>,
    params: { orgSlug: string; repository: string; pull: string },
  ) => ({
    label: data.pull?.number,
    to: `/${params.orgSlug}/settings/repositories/${params.repository}/${params.pull}`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const { repository: repositoryId, pull: pullId } = zx.parseParams(params, {
    repository: z.string(),
    pull: zx.NumAsString,
  })

  const repository = await getRepository(repositoryId)
  if (!repository || repository.organizationId !== organization.id) {
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

  const store = createStore({ organizationId: organization.id, repositoryId })
  const storeData = {
    commits: await store.loader.commits(pullId),
    comments: await store.loader.discussions(pullId),
    reviews: await store.loader.reviews(pullId),
  }

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

  return {
    organization,
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
