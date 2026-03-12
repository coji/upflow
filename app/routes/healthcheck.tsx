import type { LoaderFunction } from 'react-router'

export const loader: LoaderFunction = () => {
  return new Response('OK')
}
