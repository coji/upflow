import { ExternalLinkIcon } from 'lucide-react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
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
import { requireOrgAdmin } from '~/app/libs/auth.server'
import type { Route } from './+types/route'
import { listRepositories } from './queries.server'

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  const repositories = await listRepositories(organization.id)
  return { organization, repositories }
}

export default function OrganizationRepositoryIndexPage({
  loaderData: { organization, repositories },
}: Route.ComponentProps) {
  const slug = organization.slug
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
                        <Button asChild size="sm" variant="link">
                          <Link
                            to={`/${slug}/settings/repositories/${repo.id}`}
                          >
                            Pulls
                          </Link>
                        </Button>

                        <Button asChild size="sm" variant="link">
                          <Link
                            to={`/${slug}/settings/repositories/${repo.id}/settings`}
                          >
                            Settings
                          </Link>
                        </Button>

                        <Button asChild size="sm" variant="link">
                          <Link
                            to={`/${slug}/settings/repositories/${repo.id}/delete`}
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
            <Link to={`/${slug}/settings/repositories/add`}>
              Add Repositories
            </Link>
          </Button>
        </HStack>
      </CardFooter>
    </Card>
  )
}
