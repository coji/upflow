import { SettingsIcon } from '@chakra-ui/icons'
import { Box, GridItem, Heading, IconButton, Menu, MenuButton, MenuDivider, MenuItem, MenuList, Spacer, Stack } from '@chakra-ui/react'
import { json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import type { LoaderArgs } from '@remix-run/server-runtime'
import invariant from 'tiny-invariant'
import { AppLink } from '~/app/components/AppLink'
import { getCompany } from '~/app/models/admin/company.server'
import { requireUserId } from '~/app/session.server'

export const loader = async ({ request, params }: LoaderArgs) => {
  await requireUserId(request)
  invariant(params.companyId, 'companyId shoud specified found')

  const company = await getCompany(params.companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }

  return json(company) // ページコンポーネントの useLoaderData で使用
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
            <Box position="absolute" top="0" right="0">
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
            </Box>

            <Outlet />
          </GridItem>
        </Box>

        <Stack>
          <Heading size="md" color="gray.500">
            Integration and Repositories
          </Heading>

          <Box>
            {company.integration?.provider} {company.integration?.method} {company.integration?.privateToken}
          </Box>

          <Stack>
            {company.repositories.map((repo) => (
              <Box key={repo.id}>
                {repo.provider} {repo.projectId}
              </Box>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Box>
  )
}
export default CompanyPage
