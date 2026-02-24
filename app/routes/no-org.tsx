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
              {isSuperAdmin ? '組織を作成してください' : '招待をお待ちください'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {isSuperAdmin ? (
              <>
                <p className="text-muted-foreground">
                  まだ組織がありません。最初の組織を作成してください。
                </p>
                <Button asChild className="w-full">
                  <Link to="/admin/create">組織を作成</Link>
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">
                {user.name} さんはまだどの組織にも所属していません。
                管理者からの招待をお待ちください。
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
              ログアウト
            </Button>
          </CardContent>
        </Card>
      </Center>
    </AppLayout>
  )
}
