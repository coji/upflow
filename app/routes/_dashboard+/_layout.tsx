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
  MenuDivider,
  HStack,
  Badge,
} from '@chakra-ui/react'
import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Outlet, useLoaderData, Link } from '@remix-run/react'
import { AppLink, AppProfileMenuButton } from '~/app/components'
import { getUser } from '~/app/features/auth/services/user-session.server'

export const loader = async ({ request }: LoaderArgs) => {
  const user = await getUser(request)
  return json({ user })
}

export default function IndexPage() {
  const { user } = useLoaderData<typeof loader>()

  return (
    <Box display="grid" gridTemplateRows="auto 1fr auto" bgColor="gray.100" minH="100vh">
      <Flex alignItems="center" bgColor="white" px="4" py="1">
        <Heading fontSize="3xl">
          <AppLink to="/" color="gray.600">
            UpFlow
          </AppLink>
        </Heading>
        <Spacer />

        <Stack direction="row" alignItems="center">
          <Menu>
            <AppProfileMenuButton name={user.displayName} pictureUrl={user.pictureUrl ?? undefined} />
            <MenuList>
              <MenuItem display="block">
                <HStack>
                  <Box>
                    <Text fontSize="sm">{user.displayName}</Text>
                    <Text fontSize="xs">{user.email}</Text>
                  </Box>
                  <Spacer />
                  <Badge colorScheme={user.role === 'admin' ? 'red' : 'blue'}>{user.role}</Badge>
                </HStack>
              </MenuItem>
              {user.role === 'admin' && (
                <>
                  <MenuDivider />
                  <MenuItem as={Link} to="/admin">
                    Admin
                  </MenuItem>
                </>
              )}
              <MenuDivider />
              <MenuItem as={Link} to="/logout">
                ログアウト
              </MenuItem>
            </MenuList>
          </Menu>
        </Stack>
      </Flex>

      <Container maxW="container.xl">
        <Outlet />
      </Container>

      <Box as="footer" textAlign="center" bgColor="white" py="4">
        Copyright &copy; TechTalk Inc.
      </Box>
    </Box>
  )
}
