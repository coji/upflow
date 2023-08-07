import { SettingsIcon } from '@chakra-ui/icons'
import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, Outlet, useLoaderData } from '@remix-run/react'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { zx } from 'zodix'
import { AppProviderBadge } from '~/app/components'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Heading,
  Spacer,
  Stack,
} from '~/app/components/ui'
import { getCompany } from '~/app/models/admin/company.server'

export const loader = async ({ params }: LoaderArgs) => {
  const { companyId } = zx.parseParams(params, {
    companyId: z.string(),
  })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return json(company)
}

const CompanyPage = () => {
  const company = useLoaderData<typeof loader>()

  return (
    <Stack className="gap-2 rounded bg-background p-4 shadow">
      <div className="grid grid-cols-[auto_1fr] items-baseline gap-2">
        <div className="relative col-span-2 flex">
          <Heading size="lg">{company.name}</Heading>
          <Spacer />
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button size="icon" variant="outline">
                <SettingsIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link to="edit">Edit</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="delete" className="text-destructive">
                  Delete
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Heading size="md" color="gray.500">
        Integration and Repositories
      </Heading>

      <Button asChild>
        <Link to="export-setting">{company.exportSetting ? 'Export Settings' : 'Add Export Setting'}</Link>
      </Button>

      {company.integration ? (
        <div>
          <AppProviderBadge provider={company.integration.provider} />
        </div>
      ) : (
        <Button asChild>
          <Link to="add-integration">Add Integration</Link>
        </Button>
      )}

      {company.repositories.map((repo) => {
        const repoUrl = match(repo.provider)
          .with('github', () => `https://github.com/${repo.owner}/${repo.repo}`) // TODO: retrieve url from github api
          .with('gitlab', () => 'https://gitlab.com') // TODO: add gitlab url
          .otherwise(() => '')
        return (
          <Stack direction="row" key={repo.id}>
            <div>
              <Link to={repoUrl} target="_blank">
                {repo.name}
              </Link>{' '}
              {repo.releaseDetectionKey}
            </div>

            <Button asChild size="xs">
              <Link to={`repository/${repo.id}/edit`}>Edit</Link>
            </Button>

            <Button asChild size="xs">
              <Link to={`repository/${repo.id}/delete`}>Delete</Link>
            </Button>
          </Stack>
        )
      })}

      {company.integration && (
        <Button asChild>
          <Link to="add-repository">Add Repo</Link>
        </Button>
      )}

      <Outlet />
    </Stack>
  )
}
export default CompanyPage
