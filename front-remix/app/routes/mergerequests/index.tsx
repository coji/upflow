import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useCatch, useLoaderData } from '@remix-run/react'
import { Heading, Box } from '@chakra-ui/react'
import type { MergeRequest } from '~/models/mergeRequest.server'
import { getMergeRequestItems } from '~/models/mergeRequest.server'
import { requireUserId } from '~/session.server'

// GET リクエスト時のデータ読み込み処理 (server side)
export const loader: LoaderFunction = async ({ request, params }) => {
  await requireUserId(request)
  return json<MergeRequest[]>(await getMergeRequestItems())
}

// MergeRequest 一覧ページ (client-side)
export default function MergeRequestsIndexPage() {
  const mergeRequestItems = useLoaderData() as MergeRequest[] // loader 関数が返した json を取得
  return (
    <Box>
      <Heading>MergeRequests</Heading>
      <Box>
        {mergeRequestItems.map((mr) => (
          <Box key={mr.id}>
            {mr.author} {mr.title}
          </Box>
        ))}
      </Box>
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
