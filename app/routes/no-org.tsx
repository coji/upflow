import { Link, redirect } from 'react-router'
import { AppLayout } from '~/app/components'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Center,
} from '~/app/components/ui'
import { authClient } from '~/app/libs/auth-client'
import { getSession } from '~/app/libs/auth.server'
import type { Route } from './+types/no-org'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const session = await getSession(request)
  if (!session) {
    throw redirect('/login')
  }
  return { user: session.user }
}

export default function NoOrgPage({
  loaderData: { user },
}: Route.ComponentProps) {
  const isSuperAdmin = user.role === 'admin'

  return (
    <AppLayout>
      <Center>
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <CardTitle>
              {isSuperAdmin ? 'Create an Organization' : 'Awaiting Invitation'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {isSuperAdmin ? (
              <>
                <p className="text-muted-foreground">
                  No organizations yet. Create your first organization.
                </p>
                <Button asChild className="w-full">
                  <Link to="/admin/create">Create Organization</Link>
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">
                {user.name} is not a member of any organization yet. Please wait
                for an invitation from an administrator.
              </p>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      window.location.href = '/login'
                    },
                  },
                })
              }
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </Center>
    </AppLayout>
  )
}
