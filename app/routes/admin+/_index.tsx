import { PlusCircledIcon } from '@radix-ui/react-icons'
import { json, type LoaderArgs } from '@remix-run/node'
import { Link, Outlet, useLoaderData } from '@remix-run/react'
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/app/components/ui'
import { listCompanies } from '~/app/models/admin/company.server'

export const loader = async ({ request }: LoaderArgs) => {
  return json({ companies: await listCompanies() })
}

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
            <Link key={company.id} className="block rounded p-2 hover:bg-secondary" to={`${company.id}`}>
              {company.name}
            </Link>
          ))}
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full" variant="outline">
            <Link to="create">
              <PlusCircledIcon className="mr-2" />
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
