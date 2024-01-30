import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from '@remix-run/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect } from 'react'
import { getToast } from 'remix-toast'
import { Toaster, useToast } from '~/app/components/ui'
import { AppLoadingProgress } from './components'
import './styles/globals.css'

export const meta: MetaFunction = () => [
  { title: 'UpFlow' },
  { name: 'description', content: 'Cycletime metrics reports.' },
]

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { toast, headers } = await getToast(request)
  return json({ toastData: toast }, { headers })
}

const queryClient = new QueryClient()

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
          <Outlet />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
}
