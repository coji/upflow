import { Box, Container, Flex, Heading, Menu, MenuItem, MenuList, Spacer, Stack } from '@chakra-ui/react'
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
      <Flex alignItems="center" bgColor="white" p="2" textColor="slategray">
        <Heading>
          <AppLink to="/" color="gray.600">
            UpFlow
          </AppLink>
        </Heading>
        <Spacer />

        <Stack direction="row" alignItems="center">
          <Menu>
            <AppProfileMenuButton name={user.displayName}></AppProfileMenuButton>
            <MenuList>
              <MenuItem as={Link} to="/logout">
                Logout
              </MenuItem>
            </MenuList>
          </Menu>
        </Stack>
      </Flex>

      <Box>
        <Container maxW="container.xl">
          <Outlet />
        </Container>
      </Box>

      <Box as="footer" textAlign="center" bgColor="white" py="4">
        Copyright &copy; TechTalk Inc.
      </Box>
    </Box>
  )
}
