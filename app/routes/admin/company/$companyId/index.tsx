import { useEffect, useState } from 'react'
import type { LoaderArgs, ActionArgs } from '@remix-run/server-runtime'
import { json } from '@remix-run/node'
import { useLoaderData, Form, NavLink, useActionData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { Heading, Stack, Box, Spacer, Input, FormLabel, Button, GridItem, Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react'
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

  return (
    <Stack gap="2">
      <Box bgColor="white" boxShadow="md" p="4" rounded="md">
        <Form replace method="post" action=".">
          <Box display="grid" gridTemplateColumns="auto 1fr" gap="2" alignItems="baseline">
            <GridItem colSpan={2} display="flex" position="relative">
              <Heading size="md">Company: {company.name}</Heading>
              <Spacer />
              <Box position="absolute" top="0" right="0">
                <Menu>
                  <MenuButton as={Button} size="xs" rightIcon={<SettingsIcon />}>
                    Menu
                  </MenuButton>
                  <MenuList>
                    <MenuItem color="red.500">
                      <NavLink to="delete">Delete...</NavLink>
                    </MenuItem>
                  </MenuList>
                </Menu>
              </Box>
            </GridItem>

            <FormLabel>ID</FormLabel>
            <Box py="1">{company.id}</Box>

            <FormLabel htmlFor="name">Name</FormLabel>
            <Stack direction="row" align="center">
              {isEdit ? (
                <>
                  <Input name="name" id="name" defaultValue={company.name} autoFocus></Input>
                  <Button size="xs" onClick={() => setIsEdit(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" colorScheme="blue" size="xs">
                    Save
                  </Button>
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
      </Box>

      <Box bgColor="white" boxShadow="md" p="4" rounded="md" display="grid" gridTemplateColumns="1fr 1fr">
        <Box>
          <Box>Teams {company.teams.length}</Box>
          <Stack>
            {company.teams.map((team) => (
              <Box key={team.id}>{team.name}</Box>
            ))}
          </Stack>
        </Box>

        <Box>
          <Box>Integration {company.integration?.provider}</Box>
          <Stack>
            {company.repositories.map((repo) => (
              <Box key={repo.id}>
                {repo.provider} {repo.projectId}
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Stack>
  )
}
export default CompanyPage
