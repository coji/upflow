import type { LoaderArgs } from '@remix-run/server-runtime'
import { requireUserId } from '~/app/session.server'

import { NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { Box, Stack, Grid, Button } from '@chakra-ui/react'
import { PlusSquareIcon } from '@chakra-ui/icons'
import { getCompanies } from '~/app/models/admin/company.server'

export const loader = async ({ request }: LoaderArgs) => {
  await requireUserId(request)
  return {
    companies: await getCompanies()
  }
}

const AdminCompanyIndex = () => {
  const { companies } = useLoaderData<typeof loader>()

  return (
    <Grid display="grid" gridTemplateColumns="15rem 1fr" gap="4">
      <Box>
        <Stack bgColor="white" rounded="md" p="2" boxShadow="md">
          <Box fontWeight="bold">Companies</Box>

          {companies.map((company) => (
            <NavLink key={company.id} to={`${company.id}`} color="red">
              {({ isActive }) => (
                <Box
                  _hover={{ bgColor: !isActive ? 'gray.100' : undefined }}
                  bgColor={isActive ? 'gray.500' : 'white'}
                  color={isActive ? 'white' : 'inherit'}
                  rounded="md"
                  p="2"
                >
                  {company.name}
                </Box>
              )}
            </NavLink>
          ))}

          <NavLink to="new">
            {({ isActive }) => (
              <Button
                w="full"
                bgColor={isActive ? 'gray.500' : undefined}
                color={isActive ? 'white' : undefined}
                variant="ghost"
                fontWeight="normal"
                leftIcon={<PlusSquareIcon />}
              >
                新規作成
              </Button>
            )}
          </NavLink>
        </Stack>
      </Box>

      <Box>
        <Outlet />
      </Box>
    </Grid>
  )
}
export default AdminCompanyIndex
