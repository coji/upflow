import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireUserId } from '~/app/session.server'
import type { MergeRequest } from '~/app/models/mergeRequest.server'
import { getMergeRequestItem } from '~/app/models/mergeRequest.server'
import invariant from 'tiny-invariant'
import dayjs from 'dayjs'

import { useCatch, useLoaderData, useNavigate } from '@remix-run/react'
import { Stack, Box, Button, Drawer, DrawerBody, DrawerFooter, DrawerHeader, DrawerContent, DrawerCloseButton } from '@chakra-ui/react'

// GET リクエスト時のデータ読み込み処理 (server side)
export const loader = async ({ request, params }: LoaderArgs) => {
  await requireUserId(request)
  invariant(params.mrId, 'noteId not found')
  return json<MergeRequest>(await getMergeRequestItem(params.mrId)) // ページコンポーネントの useLoaderData で使用
}

// MergeRequest 詳細 (client-side)
export default function MergeRequestsIndexPage() {
  const mr = useLoaderData<typeof loader>() // loader 関数が返した json を取得
  const navigate = useNavigate()

  const handleClose = () => navigate('/dashboard')

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

// エラー時の処理 (client side)
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
