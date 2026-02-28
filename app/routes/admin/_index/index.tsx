import { PlusCircleIcon } from 'lucide-react'
import { Link, href } from 'react-router'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/app/components/ui'
import type { Route } from './+types/index'
import { listOrganizations } from './queries.server'

export const loader = async () => ({
  organizations: await listOrganizations(),
})

const AdminOrganizationIndex = ({
  loaderData: { organizations },
}: Route.ComponentProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell>{organization.name}</TableCell>
                  <TableCell>{organization.slug}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="link">
                      <Link to={`/${organization.slug}/settings`}>
                        Settings
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full" variant="outline">
          <Link to={href('/admin/create')}>
            <PlusCircleIcon />
            Create New
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
export default AdminOrganizationIndex
