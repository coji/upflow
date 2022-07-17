import React, { useContext, useEffect } from 'react'
import { withEmotionCache } from '@emotion/react'
import { extendTheme, ChakraProvider } from '@chakra-ui/react'
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import type { LinksFunction, LoaderFunction, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import tailwindStylesheetUrl from './styles/tailwind.css'
import { getUser } from './session.server'

import { ServerStyleContext, ClientStyleContext } from './context'

export const meta: MetaFunction = () => ({
  charset: 'utf-8',
  title: 'UpFlow - optimize development cycletime for team.',
  viewport: 'width=device-width,initial-scale=1'
})

export let links: LinksFunction = () => {
  return [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap'
    },
    { rel: 'stylesheet', href: tailwindStylesheetUrl }
  ]
}

type LoaderData = {
  user: Awaited<ReturnType<typeof getUser>>
}

export const loader: LoaderFunction = async ({ request }) =>
  json<LoaderData>({
    user: await getUser(request)
  })

interface DocumentProps {
  children: React.ReactNode
}

const Document = withEmotionCache(({ children }: DocumentProps, emotionCache) => {
  const serverStyleData = useContext(ServerStyleContext)
  const clientStyleData = useContext(ClientStyleContext)

  // Only executed on client
  useEffect(() => {
    // re-link sheet container
    emotionCache.sheet.container = document.head
    // re-inject tags
    const tags = emotionCache.sheet.tags
    emotionCache.sheet.flush()
    tags.forEach((tag) => {
      ;(emotionCache.sheet as any)._insertTag(tag)
    })
    // reset cache to reapply global styles
    clientStyleData?.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <html lang="ja" className="h-full">
      <head>
        <Meta />
        <Links />
        {serverStyleData?.map(({ key, ids, css }) => (
          <style key={key} data-emotion={`${key} ${ids.join(' ')}`} dangerouslySetInnerHTML={{ __html: css }} />
        ))}
      </head>
      <body className="h-full">
        {children}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
})

const colors = {
  brand: {
    900: '#1a365d',
    800: '#153e75',
    700: '#2a69ac'
  }
}

const theme = extendTheme({ colors })

export default function App() {
  return (
    <Document>
      <ChakraProvider theme={theme} resetCSS>
        <Outlet />
      </ChakraProvider>
    </Document>
  )
}
