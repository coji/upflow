import { SettingsIcon } from '@chakra-ui/icons'
import { Box, Button, GridItem, Heading, IconButton, Menu, MenuButton, MenuDivider, MenuItem, MenuList, Spacer, Stack } from '@chakra-ui/react'
import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { AppLink } from '~/app/components/AppLink'
import { getCompany } from '~/app/models/admin/company.server'
import { requireUserId } from '~/app/session.server'
import { AppProviderBadge } from '~/app/components/AppProviderBadge'

export const loader = async ({ request, params }: LoaderArgs) => {
  await requireUserId(request)
  invariant(params.companyId, 'companyId shoud specified found')
  const company = await getCompany(params.companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return json(company)
}

const CompanyPage = () => {
  const company = useLoaderData<typeof loader>()

  return (
    <Box bgColor="white" boxShadow="md" p="4" rounded="md">
      <Stack gap="2">
        <Box display="grid" gridTemplateColumns="auto 1fr" gap="2" alignItems="baseline">
          <GridItem colSpan={2} display="flex" position="relative">
            <Heading size="lg">{company.name}</Heading>
            <Spacer />
            <Menu>
              <MenuButton as={IconButton} size="xs" icon={<SettingsIcon />}></MenuButton>
              <MenuList>
                <AppLink to="edit">
                  <MenuItem>Edit</MenuItem>
                </AppLink>
                <MenuDivider />
                <AppLink to="delete">
                  <MenuItem color="red.500">Delete...</MenuItem>
                </AppLink>
              </MenuList>
            </Menu>

            <Outlet />
          </GridItem>
        </Box>

        <Stack>
          <Heading size="md" color="gray.500">
            Integration and Repositories
          </Heading>

          {company.integration ? (
            <Box>
              <AppProviderBadge provider={company.integration.provider} />
            </Box>
          ) : (
            <AppLink to="add-integration">
              <Button>Add Integration</Button>
            </AppLink>
          )}

          <Stack>
            {company.repositories.map((repo) => (
              <Box key={repo.id}>
                {repo.provider} {repo.projectId}
              </Box>
            ))}
          </Stack>

          {company.integration && <Box>Add Repo</Box>}
        </Stack>
      </Stack>
    </Box>
  )
}
export default CompanyPage
