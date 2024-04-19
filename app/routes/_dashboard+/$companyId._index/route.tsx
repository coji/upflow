import type { LoaderFunctionArgs } from '@remix-run/node'
import { typedjson, useTypedLoaderData } from 'remix-typedjson'
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
import { getMergedPullRequestReport, getStartOfWeek } from './functions.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const startOfWeek = getStartOfWeek()
  const pullRequests = await getMergedPullRequestReport(companyId, startOfWeek)
  return typedjson({ companyId, pullRequests, startOfWeek })
}

export default function CompanyLayout() {
  const { companyId, pullRequests } = useTypedLoaderData<typeof loader>()

  return (
    <div>
      <div>今週マージされたプルリクエスト {pullRequests.length}件</div>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PR</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Title / URL</TableHead>
              <TableHead className="whitespace-nowrap">マージまで</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pullRequests.map((pr) => (
              <TableRow key={`${companyId}-${pr.repo}-${pr.number}`}>
                <TableCell>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {pr.number}
                  </a>
                </TableCell>
                <TableCell>{pr.author}</TableCell>
                <TableCell>
                  [{pr.title}]({pr.url})
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {pr.mergedAt && pr.createAndMergeDiff?.toFixed(1)}
                  <small>日</small>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
