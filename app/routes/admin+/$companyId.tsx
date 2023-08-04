import { SettingsIcon } from '@chakra-ui/icons'
import {
  Box,
  Button,
  GridItem,
  Heading,
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Spacer,
  Stack,
  Link,
} from '@chakra-ui/react'
import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { AppLink, AppProviderBadge } from '~/app/components'
import { getCompany } from '~/app/models/admin/company.server'
import { requireUserId } from '~/app/utils/session.server'
import { match } from 'ts-pattern'

export const loader = async ({ request, params }: LoaderArgs) => {
  await requireUserId(request)
  invariant(params.companyId, 'companyId should specified found')
  const company = await getCompany(params.companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return json(company)
}

const CompanyPage = () => {
  const company = useLoaderData<typeof loader>()

  return (
    <Stack bgColor="white" boxShadow="md" p="4" rounded="md" gap="2">
      <Box display="grid" gridTemplateColumns="auto 1fr" gap="2" alignItems="baseline">
        <GridItem colSpan={2} display="flex" position="relative">
          <Heading size="lg">{company.name}</Heading>
          <Spacer />
          <Menu>
            <MenuButton as={IconButton} size="xs" icon={<SettingsIcon />}></MenuButton>
            <MenuList>
              <MenuItem as={AppLink} to="edit">
                Edit
              </MenuItem>
              <MenuDivider />
              <MenuItem as={AppLink} to="delete" color="red.500">
                Delete...
              </MenuItem>
            </MenuList>
          </Menu>
          <Outlet />
        </GridItem>
      </Box>

      <Heading size="md" color="gray.500">
        Integration and Repositories
      </Heading>

      <Button as={AppLink} to="export-setting">
        {company.exportSetting ? 'Export Settings' : 'Add Export Setting'}
      </Button>

      {company.integration ? (
        <Box>
          <AppProviderBadge provider={company.integration.provider} />
        </Box>
      ) : (
        <Button as={AppLink} to="add-integration">
          Add Integration
        </Button>
      )}

      {company.repositories.map((repo) => {
        const repoUrl = match(repo.provider)
          .with('github', () => `https://github.com/${repo.owner}/${repo.repo}`) // TODO: retrieve url from github api
          .with('gitlab', () => 'https://gitlab.com') // TODO: add gitlab url
          .otherwise(() => '')
        return (
          <Stack direction="row" key={repo.id} align="center">
            <Box>
              <Link isExternal href={repoUrl} color="blue.500">
                {repo.name}
              </Link>{' '}
              {repo.releaseDetectionKey}
            </Box>

            <Button as={AppLink} to={`repository/${repo.id}/edit`} colorScheme="blue" size="xs">
              Edit
            </Button>

            <Button as={AppLink} to={`repository/${repo.id}/delete`} colorScheme="red" size="xs">
              Delete
            </Button>
          </Stack>
        )
      })}

      {company.integration && (
        <Button as={AppLink} to="add-repository">
          Add Repo
        </Button>
      )}
    </Stack>
  )
}
export default CompanyPage
