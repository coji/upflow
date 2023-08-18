import { ExternalLinkIcon } from '@radix-ui/react-icons'
import { json, type LoaderArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Button,
  HStack,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui'
import { getCompany } from '~/app/models/admin/company.server'

export const loader = async ({ params }: LoaderArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return json({ company })
}

export default function CompanyRepositoryIndexPage() {
  const { company } = useLoaderData<typeof loader>()

  return (
    <Stack>
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
              .with('github', () => `https://github.com/${repo.owner}/${repo.repo}`) // TODO: retrieve url from github api
              .with('gitlab', () => 'https://gitlab.com') // TODO: add gitlab url
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
                      <Link to={`${repo.id}`}>Pulls</Link>
                    </Button>

                    <Button asChild size="xs" variant="outline">
                      <Link to={`${repo.id}/edit`}>Edit</Link>
                    </Button>

                    <Button asChild size="xs" variant="destructive">
                      <Link to={`${repo.id}/delete`}>Delete</Link>
                    </Button>
                  </HStack>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {company.integration && (
        <Button className="w-full" asChild>
          <Link to="add">Add Repositories</Link>
        </Button>
      )}
    </Stack>
  )
}
