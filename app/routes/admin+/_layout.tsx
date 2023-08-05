import {
  Text,
  Box,
  Container,
  Flex,
  Heading,
  Menu,
  MenuItem,
  MenuList,
  Spacer,
  Stack,
  Tag,
  MenuDivider,
  HStack,
  Badge,
} from '@chakra-ui/react'
import { json, type LoaderArgs } from '@remix-run/node'
import { Outlet, useLoaderData, Link } from '@remix-run/react'
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
      <Flex alignItems="center" bgColor="white" px="4" py="1">
        <Heading fontSize="3xl">
          <AppLink to="/admin">UpFlow Admin</AppLink>
        </Heading>

        <Spacer />
        <Stack direction="row" align="center">
          <Tag colorScheme="red" size="sm">
            Admin
          </Tag>

          <Menu>
            <AppProfileMenuButton name={adminUser.displayName} pictureUrl={adminUser.pictureUrl ?? undefined} />
            <MenuList>
              <MenuItem display="block">
                <HStack>
                  <Box>
                    <Text fontSize="sm">{adminUser.displayName}</Text>
                    <Text fontSize="xs">{adminUser.email}</Text>
                  </Box>
                  <Spacer />
                  <Badge colorScheme={adminUser.role === 'admin' ? 'red' : 'blue'}>{adminUser.role}</Badge>
                </HStack>
              </MenuItem>
              <MenuDivider />
              <MenuItem as={Link} to="/">
                ユーザー画面
              </MenuItem>
              <MenuDivider />
              <MenuItem as={Link} to="/logout">
                ログアウト
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
