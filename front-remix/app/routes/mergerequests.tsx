import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireUserId } from '~/session.server'
import type { MergeRequest } from '~/models/mergeRequest.server'
import { getMergeRequestItems } from '~/models/mergeRequest.server'

import { Form, Link, NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { Heading, Stack, Box, Flex, Spacer, Text, Button } from '@chakra-ui/react'

import { useUser } from '~/utils'

export const loader: LoaderFunction = async ({ request }) => {
  await requireUserId(request)
  return json<MergeRequest[]>(await getMergeRequestItems()) // ページコンポーネントの useLoaderData で使用
}

export default function NotesPage() {
  const mergeRequestItems = useLoaderData() as MergeRequest[] // loader 関数が返した json を取得
  const user = useUser()

  return (
    <Stack>
      <Flex alignItems="center" bgColor="slategray" p="4" textColor="white">
        <Heading>
          <Link to=".">Merge Requests</Link>
        </Heading>
        <Spacer />
        <Stack direction="row" alignItems="center">
          <Text>{user.email}</Text>
          <Form action="/logout" method="post">
            <Button type="submit" colorScheme="blackAlpha">
              Logout
            </Button>
          </Form>
        </Stack>
      </Flex>

      <main className="flex h-full bg-white">
        <div className="h-full w-80 border-r bg-gray-50">
          <Link to="new" className="block p-4 text-xl text-blue-500">
            + New Note
          </Link>

          <hr />

          <Box>
            <Heading>MergeRequests</Heading>
            <Box>
              {mergeRequestItems.map((mr) => (
                <NavLink key={mr.id} className="block border-b p-4 text-xl" to={mr.id}>
                  📝 {mr.title}
                </NavLink>
              ))}
            </Box>
          </Box>
        </div>

        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </Stack>
  )
}
