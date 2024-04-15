import { ExternalLinkIcon } from '@radix-ui/react-icons'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { $path } from 'remix-routes'
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
import { getCompany } from '~/app/models/admin/company.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return json({ companyId, company })
}

export default function CompanyRepositoryIndexPage() {
  const { companyId, company } = useLoaderData<typeof loader>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repositories</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead>Repo</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {company.repositories.map((repo) => {
                const repoUrl = match(repo.provider)
                  .with(
                    'github',
                    () => `https://github.com/${repo.owner}/${repo.repo}`,
                  ) // TODO: retrieve url from github api
                  .otherwise(() => '')
                return (
                  <TableRow key={repo.id}>
                    <TableCell>{repo.owner}</TableCell>

                    <TableCell>
                      <Link to={repoUrl} target="_blank" className="">
                        {repo.repo} <ExternalLinkIcon className="inline" />
                      </Link>
                    </TableCell>

                    <TableCell>{repo.releaseDetectionKey}</TableCell>

                    <TableCell>{repo.releaseDetectionMethod}</TableCell>

                    <TableCell>
                      <HStack>
                        <Button asChild size="xs" variant="outline">
                          <Link
                            to={$path(
                              '/admin/:companyId/repositories/:repositoryId',
                              {
                                companyId,
                                repositoryId: repo.id,
                              },
                            )}
                          >
                            Pulls
                          </Link>
                        </Button>

                        <Button asChild size="xs" variant="outline">
                          <Link
                            to={$path(
                              '/admin/:companyId/repositories/:repositoryId/settings',
                              {
                                companyId,
                                repositoryId: repo.id,
                              },
                            )}
                          >
                            Settings
                          </Link>
                        </Button>

                        <Button asChild size="xs" variant="destructive">
                          <Link
                            to={$path(
                              '/admin/:companyId/repositories/:repositoryId/delete',
                              { companyId, repositoryId: repo.id },
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
          {company.integration && (
            <Button className="w-full" asChild>
              <Link to="add">Add Repositories</Link>
            </Button>
          )}
        </HStack>
      </CardFooter>
    </Card>
  )
}
