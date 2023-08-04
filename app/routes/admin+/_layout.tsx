import { Box, Container, Flex, Heading, Menu, MenuItem, MenuList, Spacer, Stack, Tag, Divider } from '@chakra-ui/react'
import { SettingsIcon } from '@chakra-ui/icons'
import { json, type LoaderArgs } from '@remix-run/node'
import { Outlet, NavLink, useLoaderData, Link } from '@remix-run/react'
import { getAdminUser } from '~/app/features/auth/services/user-session.server'
import { AppLink, AppProfileMenuButton } from '~/app/components'

export const loader = async ({ request }: LoaderArgs) => {
  const adminUser = await getAdminUser(request)
  return json({ adminUser })
}

const AdminIndex = () => {
  const { adminUser } = useLoaderData<typeof loader>()

  return (
    <Box display="grid" gridTemplateRows="auto 1fr auto" height="100vh" color="gray.600">
      <Flex as="header" px="4" py="1" align="center" boxShadow="md">
        <Heading>
          <AppLink to="/admin">UpFlow</AppLink>
        </Heading>

        <Spacer />
        <Stack direction="row" align="center">
          <Tag colorScheme="red" size="sm">
            Admin
          </Tag>

          <Menu>
            <AppProfileMenuButton name={adminUser.displayName}></AppProfileMenuButton>
            <MenuList>
              <MenuItem as={NavLink} to="/admin/settings" icon={<SettingsIcon />}>
                Settings
              </MenuItem>
              <Divider />
              <MenuItem as={Link} to="/logout">
                Logout
              </MenuItem>
            </MenuList>
          </Menu>
        </Stack>
      </Flex>

      <Box as="main" bgColor="gray.200">
        <Container p="4" maxWidth="container.xl">
          <Outlet />
        </Container>
      </Box>

      <Box as="footer" textAlign="center" p="4" boxShadow="md">
        Copyright&copy; TechTalk Inc.
      </Box>
    </Box>
  )
}
export default AdminIndex
