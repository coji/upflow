import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import { getPullRequestReport } from '~/app/models/pullRequest.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  console.log({ companyId })
  const pullRequests = await getPullRequestReport(companyId)
  return json({ companyId, pullRequests })
}

export default function CompanyIndexPage() {
  const { companyId, pullRequests } = useLoaderData<typeof loader>()

  return (
    <div>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PR</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Merged</TableHead>
              <TableHead>Deployed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pullRequests.map((pr) => (
              <TableRow key={`${companyId}-${pr.repo}-${pr.number}`}>
                <TableCell>{pr.number}</TableCell>
                <TableCell>{pr.author}</TableCell>
                <TableCell>{pr.title}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {pr.pullRequestCreatedAt &&
                    dayjs(pr.pullRequestCreatedAt).format('YYYY-MM-DD')}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {pr.mergedAt && dayjs(pr.mergedAt).format('YYYY-MM-DD')}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {pr.releasedAt && dayjs(pr.releasedAt).format('YYYY-MM-DD')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
