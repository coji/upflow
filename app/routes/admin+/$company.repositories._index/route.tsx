import { ExternalLinkIcon } from 'lucide-react'
import { Link, href } from 'react-router'
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
import type { Route } from './+types/route'
import { listRepositories } from './queries.server'

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  const repositories = await listRepositories(companyId)
  return { companyId, repositories }
}

export default function CompanyRepositoryIndexPage({
  loaderData: { companyId, repositories },
}: Route.ComponentProps) {
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
                            to={href(
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
                            to={href(
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
                            to={href(
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
            <Link
              to={href('/admin/:company/repositories/add', {
                company: companyId,
              })}
            >
              Add Repositories
            </Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
