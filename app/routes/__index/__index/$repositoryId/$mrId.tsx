import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Stack
} from '@chakra-ui/react'
import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useCatch, useLoaderData, useNavigate } from '@remix-run/react'
import invariant from 'tiny-invariant'
import dayjs from '~/app/libs/dayjs'
import { getMergeRequestItem } from '~/app/models/mergeRequest.server'

export const loader = async ({ request, params }: LoaderArgs) => {
  invariant(params.repositoryId, 'repositoryId should specified')
  invariant(params.mrId, 'mrId shoud specified found')

  const mergeRequests = await getMergeRequestItem(params.repositoryId, params.mrId).catch(() => null)
  if (!mergeRequests) {
    throw new Response('404', { status: 404 })
  }
  return json(mergeRequests)
}

export default function MergeRequestsIndexPage() {
  const mr = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  const handleClose = () => navigate('../..')

  return (
    <Drawer isOpen={true} placement="right" onClose={() => handleClose()}>
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Create your account</DrawerHeader>

        <DrawerBody>
          <Stack>
            <Box>id: {mr.id}</Box>
            <Box>state: {mr.state}</Box>
            <Box>author: {mr.author}</Box>
            <Box>created: {dayjs(mr.mergerequest_created_at).format('YYYY-MM-DD HH:mm')}</Box>
            <Box fontSize="sm" w="full" overflow="auto" rounded="md" bgColor="black" color="white" p="2">
              <pre>{JSON.stringify(mr, null, 2)}</pre>
            </Box>
          </Stack>
        </DrawerBody>

        <DrawerFooter>
          <Button variant="outline" mr={3} onClick={() => handleClose()}>
            Cancel
          </Button>
          <Button colorScheme="blue">Save</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error)

  return <div>An unexpected error occurred: {error.message}</div>
}

export function CatchBoundary() {
  const caught = useCatch()
  if (caught.status === 404) {
    return <div>Note not found</div>
  }
  throw new Error(`Unexpected caught response with status: ${caught.status}`)
}
