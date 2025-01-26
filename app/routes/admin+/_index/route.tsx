import { PlusCircleIcon } from 'lucide-react'
import type { LoaderFunctionArgs } from 'react-router'
import { Link, Outlet, useLoaderData } from 'react-router'
import { $path } from 'safe-routes'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/app/components/ui'
import { listCompanies } from './queries.server'

export const loader = async ({ request }: LoaderFunctionArgs) => ({
  companies: await listCompanies(),
})

const AdminCompanyIndex = () => {
  const { companies } = useLoaderData<typeof loader>()

  return (
    <div className="grid grid-cols-[15rem_1fr] gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
        </CardHeader>
        <CardContent>
          {companies.map((company) => (
            <Link
              key={company.id}
              className="hover:bg-secondary block rounded p-2"
              to={`${company.id}`}
            >
              {company.name}
            </Link>
          ))}
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full" variant="outline">
            <Link to={$path('/admin/create')}>
              <PlusCircleIcon className="mr-2" />
              新規作成
            </Link>
          </Button>
        </CardFooter>
      </Card>

      <Outlet />
    </div>
  )
}
export default AdminCompanyIndex
