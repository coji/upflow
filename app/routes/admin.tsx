import type { LoaderArgs } from '@remix-run/server-runtime'
import { requireUserId } from '~/app/session.server'

import { NavLink, Outlet, useLoaderData, useParams } from '@remix-run/react'
import { Box, Flex, Spacer, Heading, Container, Stack, Tag, Grid, Button } from '@chakra-ui/react'
import { PlusSquareIcon } from '@chakra-ui/icons'
import { useUser } from '~/app/utils'
import { getCompaniesByUser } from '../models/company.server'

export const loader = async ({ request, params }: LoaderArgs) => {
  const userId = await requireUserId(request)
  return {
    companies: await getCompaniesByUser(userId)
  }
}

const AdminIndex = () => {
  const user = useUser()
  const { companies } = useLoaderData<typeof loader>()
  const { companyId } = useParams()

  return (
    <Box display="grid" gridTemplateRows="auto 1fr auto" height="100vh" color="gray.600">
      <Flex as="header" px="4" py="1" align="center" boxShadow="md">
        <Heading>
          <NavLink to="/admin">UpFlow</NavLink>
        </Heading>
        <Spacer />
        <Stack direction="row" align="center">
          <Tag colorScheme="red" size="sm">
            Admin
          </Tag>
          <Box textAlign="right">{user.name} </Box>
        </Stack>
      </Flex>

      <Box as="main" bgColor="gray.200" p="4">
        <Container maxWidth="container.xl">
          <Grid display="grid" gridTemplateColumns="15rem 1fr" gap="4">
            <Stack bgColor="white" rounded="md" p="2" boxShadow="md">
              <Box fontWeight="bold">Companies</Box>

              {companies.map((company) => {
                const isActive = companyId === company.id
                return (
                  <NavLink key={company.id} to={`company/${company.id}`}>
                    <Box
                      _hover={{ bgColor: !isActive ? 'gray.100' : undefined }}
                      bgColor={isActive ? 'gray.500' : 'white'}
                      color={isActive ? 'white' : 'inherit'}
                      rounded="md"
                      p="2"
                    >
                      {company.name}
                    </Box>
                  </NavLink>
                )
              })}

              <Spacer />

              <Button variant="ghost" fontWeight="normal" leftIcon={<PlusSquareIcon />}>
                新規作成
              </Button>
            </Stack>

            <Box>
              <Outlet />
            </Box>
          </Grid>
        </Container>
      </Box>

      <Box as="footer" textAlign="center" p="4" boxShadow="md">
        Copyright&copy; TechTalk Inc.
      </Box>
    </Box>
  )
}
export default AdminIndex
