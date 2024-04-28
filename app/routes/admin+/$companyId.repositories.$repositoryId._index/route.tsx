import type { LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { $path } from 'remix-routes'
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
import { getRepository, listPullRequests } from './queries.server'

export const handle = {
  breadcrumb: ({
    companyId,
    repositoryId,
    repository,
  }: {
    companyId: string
    repositoryId: string
    repository: NonNullable<Awaited<ReturnType<typeof getRepository>>>
  }) => ({
    label: `${repository.owner}/${repository.repo}`,
    to: $path('/admin/:companyId/repositories/:repositoryId', {
      companyId,
      repositoryId,
    }),
  }),
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId, repositoryId } = zx.parseParams(params, {
    companyId: z.string(),
    repositoryId: z.string(),
  })

  const repository = await getRepository(repositoryId)
  if (!repository) {
    throw new Response('repository not found', { status: 404 })
  }
  const pulls = await listPullRequests(repositoryId)

  return { companyId, repositoryId, repository, pulls }
}

const RepositoryPullsIndexPage = () => {
  const { companyId, repositoryId, repository, pulls } =
    useLoaderData<typeof loader>()

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
        <div className="rounded-lg border shadow-sm">
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
                        to={$path(
                          '/admin/:companyId/repositories/:repositoryId/:pullId',
                          { companyId, repositoryId, pullId: pull.number },
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
export default RepositoryPullsIndexPage
