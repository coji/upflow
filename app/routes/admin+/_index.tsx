import { PlusSquareIcon } from '@chakra-ui/icons'
import type { LoaderArgs } from '@remix-run/node'
import { Link, Outlet, useLoaderData } from '@remix-run/react'
import { Button, Heading, Stack } from '~/app/components/ui'
import { getCompanies } from '~/app/models/admin/company.server'

export const loader = async ({ request }: LoaderArgs) => {
  return {
    companies: await getCompanies(),
  }
}

const AdminCompanyIndex = () => {
  const { companies } = useLoaderData<typeof loader>()

  return (
    <div className="grid grid-cols-[15rem_1fr] gap-4">
      <div>
        <Stack className="rounded bg-background p-4 shadow">
          <Heading size="md">Companies</Heading>

          {companies.map((company) => (
            <Link key={company.id} className="rounded p-2 hover:bg-gray-200" to={`${company.id}`}>
              {company.name}
            </Link>
          ))}

          <Button asChild className="w-full" variant="ghost">
            <Link to="new">
              <PlusSquareIcon className="mr-2" />
              新規作成
            </Link>
          </Button>
        </Stack>
      </div>

      <Outlet />
    </div>
  )
}
export default AdminCompanyIndex
