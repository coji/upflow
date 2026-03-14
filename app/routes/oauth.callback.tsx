import { useSearchParams } from 'react-router'

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') ?? ''
  const state = searchParams.get('state') ?? ''
  const error = searchParams.get('error') ?? ''

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">OAuth Callback</h1>
      {error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : (
        <div className="w-full space-y-2 rounded-lg border p-4">
          <div>
            <p className="text-muted-foreground text-sm">Code</p>
            <p className="font-mono text-sm break-all">{code}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">State</p>
            <p className="font-mono text-sm">{state}</p>
          </div>
        </div>
      )}
    </main>
  )
}
