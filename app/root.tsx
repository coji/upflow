import { useEffect } from 'react'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  data,
  isRouteErrorResponse,
  useRouteError,
} from 'react-router'
import { getToast } from 'remix-toast'
import { toast } from 'sonner'
import { match } from 'ts-pattern'
import { Toaster } from '~/app/components/ui'
import type { Route } from './+types/root'
import { AppLoadingProgress } from './components'
import './styles/globals.css'

export const meta: Route.MetaFunction = () => [
  { title: 'UpFlow' },
  { name: 'description', content: 'Cycletime metrics reports.' },
]

export const loader = async ({ request }: Route.LoaderArgs) => {
  const { toast, headers } = await getToast(request)
  return data({ toastData: toast }, { headers })
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Toaster />
        <AppLoadingProgress />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App({
  loaderData: { toastData },
}: Route.ComponentProps) {
  useEffect(() => {
    if (toastData) {
      const toastFn = match(toastData.type)
        .with('success', () => toast.success)
        .with('error', () => toast.error)
        .with('info', () => toast.info)
        .with('warning', () => toast.warning)
        .exhaustive()
      toastFn(toastData.message, {
        duration: toastData.duration,
        description: toastData.description,
      })
    }
  }, [toastData])

  return <Outlet />
}

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </main>
    )
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Error!</h1>
      <p>
        {error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Unknown error'}
      </p>
    </main>
  )
}
