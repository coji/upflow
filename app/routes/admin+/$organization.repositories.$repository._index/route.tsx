import { href, Link } from 'react-router'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  HStack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui'
import type { Route } from './+types/route'
import { getRepository, listPullRequests } from './queries.server'

export const handle = {
  breadcrumb: ({
    organizationId,
    repositoryId,
    repository,
  }: Awaited<ReturnType<typeof loader>>) => ({
    label: `${repository.owner}/${repository.repo}`,
    to: href('/admin/:organization/repositories/:repository', {
      organization: organizationId,
      repository: repositoryId,
    }),
  }),
}

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { organization: organizationId, repository: repositoryId } =
    zx.parseParams(params, {
      organization: z.string(),
      repository: z.string(),
    })

  const repository = await getRepository(repositoryId)
  if (!repository) {
    throw new Response('repository not found', { status: 404 })
  }
  const pulls = await listPullRequests(repositoryId)

  return { organizationId, repositoryId, repository, pulls }
}

export default function RepositoryPullsIndexPage({
  loaderData: { organizationId, repositoryId, repository, pulls },
}: Route.ComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <HStack>
            <div>
              {repository.owner}/{repository.repo}
            </div>
            <Badge variant="outline">repository</Badge>
          </HStack>
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                        to={href(
                          '/admin/:organization/repositories/:repository/:pull',
                          {
                            organization: organizationId,
                            repository: repositoryId,
                            pull: String(pull.number),
                          },
                        )}
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
      </CardContent>
    </Card>
  )
}
