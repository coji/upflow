import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireUserId } from '~/session.server'
import type { MergeRequest } from '~/models/mergeRequest.server'
import { getMergeRequestItem } from '~/models/mergeRequest.server'
import invariant from 'tiny-invariant'

import { useCatch, useLoaderData } from '@remix-run/react'
import { Heading, Stack, Box } from '@chakra-ui/react'

// GET リクエスト時のデータ読み込み処理 (server side)
export const loader: LoaderFunction = async ({ request, params }) => {
  await requireUserId(request)
  invariant(params.mrId, 'noteId not found')
  return json<MergeRequest>(await getMergeRequestItem(params.mrId)) // ページコンポーネントの useLoaderData で使用
}

// MergeRequest 詳細 (client-side)
export default function MergeRequestsIndexPage() {
  const mr = useLoaderData() as MergeRequest // loader 関数が返した json を取得
  return (
    <Box>
      <Heading>{mr.title}</Heading>
      <Stack>
        <Box>id: {mr.id}</Box>
        <Box>state: {mr.state}</Box>
        <Box>author: {mr.author}</Box>
        <Box>created: {mr.mergerequest_created_at}</Box>
      </Stack>
    </Box>
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
