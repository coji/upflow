import { useEffect, useState } from 'react'
import type { LoaderArgs, ActionArgs } from '@remix-run/server-runtime'
import { json } from '@remix-run/node'
import { useLoaderData, Form, NavLink, useActionData, useTransition, Outlet } from '@remix-run/react'
import invariant from 'tiny-invariant'
import {
  Heading,
  Stack,
  Box,
  Spacer,
  Input,
  FormLabel,
  Button,
  GridItem,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Divider,
  Avatar,
  TableContainer,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  CircularProgress
} from '@chakra-ui/react'
import { SettingsIcon } from '@chakra-ui/icons'
import dayjs from '~/app/libs/dayjs'

import { requireUserId } from '~/app/session.server'
import { getCompany, updateCompany } from '~/app/models/admin/company.server'

export const loader = async ({ request, params }: LoaderArgs) => {
  await requireUserId(request)
  invariant(params.companyId, 'companyId shoud specified found')

  const company = await getCompany(params.companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }

  return json(company) // ページコンポーネントの useLoaderData で使用
}

export const action = async ({ request, params }: ActionArgs) => {
  const { companyId } = params
  const formData = await request.formData()
  const name = formData.get('name')
  if (companyId && name) return await updateCompany(companyId, name.toString())
  else return null
}

const CompanyPage = () => {
  const company = useLoaderData<typeof loader>()

  const [isEdit, setIsEdit] = useState(false)
  const actionData = useActionData()
  useEffect(() => {
    setIsEdit(false)
  }, [actionData, company])

  const transition = useTransition()

  return (
    <Box bgColor="white" boxShadow="md" p="4" rounded="md">
      <Stack gap="2">
        <Form replace method="post" action=".">
          <Box display="grid" gridTemplateColumns="auto 1fr" gap="2" alignItems="baseline">
            <GridItem colSpan={2} display="flex" position="relative">
              <Heading size="md">{company.name}</Heading>
              <Spacer />
              <Box position="absolute" top="0" right="0">
                <Menu>
                  <MenuButton as={IconButton} size="xs" icon={<SettingsIcon />}></MenuButton>
                  <MenuList>
                    <NavLink to="delete">
                      <MenuItem color="red.500">Delete...</MenuItem>
                    </NavLink>
                  </MenuList>
                </Menu>
              </Box>

              <Outlet />
            </GridItem>

            <FormLabel htmlFor="name">Name</FormLabel>
            <Stack direction="row" align="center">
              {isEdit ? (
                <>
                  <Input name="name" id="name" defaultValue={company.name} autoFocus></Input>
                  <Stack direction="row" align="center">
                    {transition.state === 'submitting' && <CircularProgress size="6" isIndeterminate />}
                    <Button size="xs" onClick={() => setIsEdit(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" colorScheme="blue" size="xs">
                      Save
                    </Button>
                  </Stack>
                </>
              ) : (
                <>
                  <Box py="1">{company.name}</Box>
                  <Button size="xs" onClick={() => setIsEdit(true)}>
                    Edit
                  </Button>
                </>
              )}
            </Stack>

            <FormLabel>Updated At</FormLabel>
            <Box py="1">{dayjs(company.updatedAt).fromNow()}</Box>

            <FormLabel>Created At</FormLabel>
            <Box py="1">{dayjs(company.createdAt).fromNow()}</Box>
          </Box>
        </Form>

        <Divider />

        <Box>
          <Heading size="md">Integration and Repositories</Heading>
          {company.integration?.provider} {company.integration?.method} {company.integration?.privateToken}
          <Stack>
            {company.repositories.map((repo) => (
              <Box key={repo.id}>
                {repo.provider} {repo.projectId}
              </Box>
            ))}
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Heading size="md">Teams and Users</Heading>
          <Box>Teams {company.teams.length}</Box>
          <Stack>
            {company.teams.map((team) => (
              <Box key={team.id}>{team.name}</Box>
            ))}
          </Stack>

          <Box>Users</Box>
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>User Name</Th>
                  <Th>Invited At</Th>
                  <Th>Created At</Th>
                </Tr>
              </Thead>
              <Tbody>
                {company.users.map((user) => (
                  <Tr key={user.id}>
                    <Td>
                      <Stack direction="row">
                        <Avatar name={user.user.name} size="xs"></Avatar>
                        <Box>{user.user.name}</Box>
                      </Stack>
                    </Td>
                    <Td>
                      <Box>{user.invitedAt}</Box>
                    </Td>
                    <Td>
                      <Box>{dayjs(user.createdAt).fromNow()}</Box>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      </Stack>
    </Box>
  )
}
export default CompanyPage
