import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { Heading, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/app/components/ui'
import { listPullRequests } from '~/app/models/admin/pull-requests.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId, repositoryId } = zx.parseParams(params, { companyId: z.string(), repositoryId: z.string() })
  const pulls = await listPullRequests(repositoryId)
  return json({ companyId, repositoryId, pulls })
}

const RepositoryPullsIndexPage = () => {
  const { pulls } = useLoaderData<typeof loader>()

  return (
    <div>
      <Heading>Pull Requests</Heading>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>number</TableHead>
              <TableHead>state</TableHead>
              <TableHead>author</TableHead>
              <TableHead>title</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pulls.map((pull) => {
              return (
                <TableRow key={pull.number}>
                  <TableCell>{pull.number}</TableCell>
                  <TableCell>{pull.state}</TableCell>
                  <TableCell>{pull.author}</TableCell>
                  <TableCell>
                    <Link to={`${pull.number}`}>{pull.title}</Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
export default RepositoryPullsIndexPage
