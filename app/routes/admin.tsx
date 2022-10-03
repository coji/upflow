import {
  Box,
  Container,
  Flex,
  Heading,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spacer,
  Stack,
  Tag,
  Divider
} from '@chakra-ui/react'
import { SettingsIcon } from '@chakra-ui/icons'
import type { LoaderArgs } from '@remix-run/node'
import { Outlet, useSubmit, NavLink } from '@remix-run/react'
import { requireAdminUserId } from '~/app/utils/session.server'
import { useUser } from '~/app/utils/utils'
import { AppLink, AppProfileMenuButton } from '../components'

export const loader = async ({ request }: LoaderArgs) => {
  await requireAdminUserId(request)
  return {}
}

const AdminIndex = () => {
  const user = useUser()
  const submit = useSubmit()

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
            <AppProfileMenuButton name={user.name}></AppProfileMenuButton>
            <MenuList>
              <MenuItem as={NavLink} to="/admin/settings" icon={<SettingsIcon />}>
                Settings
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  submit(null, { method: 'post', action: 'logout' })
                }}
              >
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
