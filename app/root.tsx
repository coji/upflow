import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { withEmotionCache } from '@emotion/react'
import type { LinksFunction, LoaderFunction, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import { useContext, useEffect } from 'react'
import { ClientStyleContext, ServerStyleContext } from './utils/context'
import { getUser } from './utils/session.server'

export const meta: MetaFunction = () => ({
  charset: 'utf-8',
  title: 'UpFlow',
  viewport: 'width=device-width,initial-scale=1'
})

export let links: LinksFunction = () => {
  return []
}

type LoaderData = {
  user: Awaited<ReturnType<typeof getUser>>
}

export const loader: LoaderFunction = async ({ request }) => {
  const user = await getUser(request)
  return json<LoaderData>({ user })
}

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
    <html lang="ja">
      <head>
        <Meta />
        <Links />
        {serverStyleData?.map(({ key, ids, css }) => (
          <style key={key} data-emotion={`${key} ${ids.join(' ')}`} dangerouslySetInnerHTML={{ __html: css }} />
        ))}
      </head>
      <body>
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
