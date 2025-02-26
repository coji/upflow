import { PlusCircleIcon } from 'lucide-react'
import { Link, Outlet, href } from 'react-router'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/app/components/ui'
import type { Route } from './+types/route'
import { listCompanies } from './queries.server'

export const loader = async ({ request }: Route.LoaderArgs) => ({
  companies: await listCompanies(),
})

const AdminCompanyIndex = ({
  loaderData: { companies },
}: Route.ComponentProps) => {
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
            <Link to={href('/admin/create')}>
              <PlusCircleIcon />
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
