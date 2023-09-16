import type { LinksFunction, MetaFunction } from '@remix-run/node'
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createHead } from 'remix-island'
import { AppLoadingProgress } from './components'
import globalStyles from './styles/globals.css'

export const meta: MetaFunction = () => [
  { title: 'UpFlow' },
  { name: 'description', content: 'Cycletime metrics reports.' },
]

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: globalStyles }]
}

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <Meta />
    <Links />
  </>
))

const queryClient = new QueryClient()

export default function App() {
  return (
    <>
      <Head />
      <QueryClientProvider client={queryClient}>
        <AppLoadingProgress />
        <Outlet />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
      <ScrollRestoration />
      <Scripts />
      <LiveReload />
    </>
  )
}
