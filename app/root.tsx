import { ChakraProvider } from '@chakra-ui/react'
import type { LinksFunction, V2_MetaFunction } from '@remix-run/node'
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createHead } from 'remix-island'
import globalStyles from './styles/globals.css'

export const meta: V2_MetaFunction = () => [
  { charSet: 'utf-8' },
  { name: 'viewport', content: 'width=device-width,initial-scale=1' },
  { title: 'UpFlow' },
  { name: 'description', content: 'Cycletime metrics reports.' },
]

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: globalStyles }]
}

export const Head = createHead(() => (
  <>
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
        <ChakraProvider resetCSS>
          <Outlet />
        </ChakraProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
      <ScrollRestoration />
      <Scripts />
      <LiveReload />
    </>
  )
}
