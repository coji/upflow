import { ExternalLinkIcon } from 'lucide-react'
import type { LoaderFunctionArgs } from 'react-router'
import { Link, useLoaderData } from 'react-router'
import { $path } from 'safe-routes'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
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
import { listRepositories } from './queries.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  const repositories = await listRepositories(companyId)
  return { companyId, repositories }
}

export default function CompanyRepositoryIndexPage() {
  const { companyId, repositories } = useLoaderData<typeof loader>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repositories</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Repo</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repositories.map((repo) => {
                const repoUrl = match(repo.provider)
                  .with(
                    'github',
                    () => `https://github.com/${repo.owner}/${repo.repo}`,
                  ) // TODO: retrieve url from github api
                  .otherwise(() => '')
                return (
                  <TableRow key={repo.id}>
                    <TableCell>
                      <Link to={repoUrl} target="_blank" className="">
                        {repo.owner}/{repo.repo}{' '}
                        <ExternalLinkIcon className="inline-block h-4 w-4" />
                      </Link>
                    </TableCell>

                    <TableCell>{repo.releaseDetectionKey}</TableCell>

                    <TableCell>{repo.releaseDetectionMethod}</TableCell>

                    <TableCell>
                      <HStack>
                        <Button asChild size="xs" variant="link">
                          <Link
                            to={$path(
                              '/admin/:company/repositories/:repository',
                              {
                                company: companyId,
                                repository: repo.id,
                              },
                            )}
                          >
                            Pulls
                          </Link>
                        </Button>

                        <Button asChild size="xs" variant="link">
                          <Link
                            to={$path(
                              '/admin/:company/repositories/:repository/settings',
                              {
                                company: companyId,
                                repository: repo.id,
                              },
                            )}
                          >
                            Settings
                          </Link>
                        </Button>

                        <Button asChild size="xs" variant="link">
                          <Link
                            to={$path(
                              '/admin/:company/repositories/:repository/delete',
                              { company: companyId, repository: repo.id },
                            )}
                          >
                            Delete
                          </Link>
                        </Button>
                      </HStack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
        <HStack>
          <Button className="w-full" asChild>
            <Link to="add">Add Repositories</Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
