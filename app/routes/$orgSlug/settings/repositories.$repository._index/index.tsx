import { zx } from '@coji/zodix/v4'
import { Link } from 'react-router'
import { z } from 'zod'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import ContentSection from '../+components/content-section'
import type { Route } from './+types/index'
import { getRepository, listPullRequests } from './queries.server'

export const handle = {
  breadcrumb: ({
    organization,
    repositoryId,
    repository,
  }: Awaited<ReturnType<typeof loader>>) => ({
    label: `${repository.owner}/${repository.repo}`,
    to: `/${organization.slug}/settings/repositories/${repositoryId}`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const { repository: repositoryId } = zx.parseParams(params, {
    repository: z.string(),
  })

  const repository = await getRepository(repositoryId)
  if (!repository || repository.organizationId !== organization.id) {
    throw new Response('repository not found', { status: 404 })
  }
  const pulls = await listPullRequests(repositoryId)

  return { organization, repositoryId, repository, pulls }
}

export default function RepositoryPullsIndexPage({
  loaderData: { organization, repositoryId, repository, pulls },
}: Route.ComponentProps) {
  const slug = organization.slug
  return (
    <ContentSection
      title={`${repository.owner}/${repository.repo}`}
      desc="Pull requests tracked for this repository."
      fullWidth
    >
      <div className="rounded-lg border shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>number</TableHead>
              <TableHead>state</TableHead>
              <TableHead>author</TableHead>
              <TableHead>title</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pulls.map((pull) => {
              return (
                <TableRow key={pull.number}>
                  <TableCell>{pull.number}</TableCell>
                  <TableCell>{pull.state}</TableCell>
                  <TableCell>{pull.author}</TableCell>
                  <TableCell
                    style={{
                      lineBreak: 'strict',
                      wordBreak: 'normal',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <Link
                      className="underline"
                      to={`/${slug}/settings/repositories/${repositoryId}/${pull.number}`}
                    >
                      {pull.title}
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </ContentSection>
  )
}
