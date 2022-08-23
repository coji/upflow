import { useEffect, useState } from 'react'
import type { LoaderArgs, ActionArgs } from '@remix-run/server-runtime'
import { json } from '@remix-run/node'
import { useLoaderData, Form, NavLink, useActionData, useTransition } from '@remix-run/react'
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
  CircularProgress
} from '@chakra-ui/react'
import { SettingsIcon } from '@chakra-ui/icons'
import dayjs from 'dayjs'

import { requireUserId } from '~/app/session.server'
import { getCompany, updateCompany } from '~/app/models/admin/company.server'

export const loader = async ({ request, params }: LoaderArgs) => {
  console.log('loader', params)
  await requireUserId(request)
  invariant(params.companyId, 'companyId shoud specified found')
  return json(await getCompany(params.companyId)) // ページコンポーネントの useLoaderData で使用
}

export const action = async ({ request, params }: ActionArgs) => {
  console.log('action', params)
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
    if (actionData) {
      setIsEdit(false)
    }
  }, [actionData])

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
            <Box py="1">{dayjs(company.updatedAt).format()}</Box>

            <FormLabel>Created At</FormLabel>
            <Box py="1">{dayjs(company.createdAt).format()}</Box>
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

          <Box>Users {company.users.length}</Box>
          <Stack>
            {company.users.map((user) => (
              <Box key={user.id}>
                {user.id} {dayjs(user.createdAt).format()}
              </Box>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Box>
  )
}
export default CompanyPage
