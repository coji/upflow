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
import { listOrganizations } from './queries.server'

export const loader = async ({ request }: Route.LoaderArgs) => ({
  organizations: await listOrganizations(),
})

const AdminOrganizationIndex = ({
  loaderData: { organizations },
}: Route.ComponentProps) => {
  return (
    <div className="grid grid-cols-[15rem_1fr] gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {organizations.map((organization) => (
            <Link
              key={organization.id}
              className="hover:bg-secondary block rounded p-2"
              to={`${organization.id}`}
            >
              {organization.name}
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
export default AdminOrganizationIndex
