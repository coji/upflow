import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect } from 'react'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  data,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  type LoaderFunctionArgs,
} from 'react-router'
import { getToast } from 'remix-toast'
import { Toaster, useToast } from '~/app/components/ui'
import { AppLoadingProgress } from './components'
import './styles/globals.css'

export const meta = () => [
  { title: 'UpFlow' },
  { name: 'description', content: 'Cycletime metrics reports.' },
]

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { toast, headers } = await getToast(request)
  return data({ toastData: toast }, { headers })
}

const queryClient = new QueryClient()

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
        <QueryClientProvider client={queryClient}>
          <Toaster />
          <AppLoadingProgress />
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  const { toastData } = useLoaderData<typeof loader>()
  const { toast } = useToast()

  useEffect(() => {
    if (toastData) {
      toast({
        variant: toastData.type === 'error' ? 'destructive' : 'default',
        description: toastData.message,
      })
    }
  }, [toastData, toast])

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
