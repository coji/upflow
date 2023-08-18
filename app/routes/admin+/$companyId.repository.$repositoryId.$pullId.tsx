import { json, type LoaderArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { z } from 'zod'
import { zx } from 'zodix'
import { Heading, Stack } from '~/app/components/ui'
import { getPullRequest } from '~/app/models/admin/pull-requests.server'
import { getRepository } from '~/app/models/admin/repository.server'
import { createFetcher } from '~/batch/provider/github/fetcher'

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
  invariant(repository.owner, 'Repository is not integrated')
  invariant(repository.repo, 'Repository is not integrated')
  invariant(repository.integration, 'Repository is not integrated')
  invariant(repository.integration.privateToken, 'Repository is not integrated')

  const pull = await getPullRequest(pullId)

  const fetcher = createFetcher({
    owner: repository.owner,
    repo: repository.repo,
    token: repository.integration.privateToken,
  })

  const commits = await fetcher.commits(pullId)
  const comments = await fetcher.comments(pullId)
  const reviews = await fetcher.reviews(pullId)
  return json({ companyId, repositoryId, pull, commits, comments, reviews })
}

const RepositoryPullsIndexPage = () => {
  const { pull, comments, reviews, commits } = useLoaderData<typeof loader>()

  return (
    <Stack>
      <div>
        <Heading>Pull Request Details</Heading>
        <pre>{JSON.stringify(pull, null, 2)}</pre>
      </div>

      <div>
        <Heading>ReviewComments (live)</Heading>
        <pre>{JSON.stringify(comments, null, 2)}</pre>
      </div>

      <div>
        <Heading>Reviews (live)</Heading>
        <pre>{JSON.stringify(reviews, null, 2)}</pre>
      </div>

      <div>
        <Heading>Commits (live)</Heading>
        <pre>{JSON.stringify(commits, null, 2)}</pre>
      </div>
    </Stack>
  )
}
export default RepositoryPullsIndexPage
