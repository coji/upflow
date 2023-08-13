import { ExternalLinkIcon } from '@radix-ui/react-icons'
import { json, type LoaderArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { zx } from 'zodix'
import { Button, HStack, Spacer, Stack } from '~/app/components/ui'
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
      {company.repositories.map((repo) => {
        const repoUrl = match(repo.provider)
          .with('github', () => `https://github.com/${repo.owner}/${repo.repo}`) // TODO: retrieve url from github api
          .with('gitlab', () => 'https://gitlab.com') // TODO: add gitlab url
          .otherwise(() => '')
        return (
          <HStack key={repo.id}>
            <Link to={`${repo.id}/edit`}>
              <span className="underline decoration-border hover:text-primary">
                {repo.name} {repo.releaseDetectionKey}
              </span>
            </Link>

            <Button asChild size="xs" variant="outline">
              <Link to={repoUrl} target="_blank">
                {repo.provider} <ExternalLinkIcon />
              </Link>
            </Button>

            <Spacer />

            <Button
              asChild
              size="xs"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Link to={`${repo.id}/delete`}>Delete</Link>
            </Button>
          </HStack>
        )
      })}

      {company.integration && (
        <Button className="w-full" asChild>
          <Link to="add">Add Repositories</Link>
        </Button>
      )}
    </Stack>
  )
}
