import { useSearchParams } from 'react-router'

export default function OAuthConsentPage() {
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('client_id') ?? ''
  const scope = searchParams.get('scope') ?? ''

  const handleConsent = async (accept: boolean) => {
    const res = await fetch('/api/auth/oauth2/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accept,
        scope,
        oauth_query: searchParams.toString(),
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const redirectUrl = data.url ?? data.redirect_uri ?? data.redirectURI
      if (redirectUrl) {
        window.location.href = redirectUrl
        return
      }
    }
    const text = await res.text()
    console.error('Consent failed:', res.status, text)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Authorize Application</h1>

      <div className="w-full space-y-4 rounded-lg border p-6">
        <div>
          <p className="text-muted-foreground text-sm">Application</p>
          <p className="font-mono text-sm">{clientId}</p>
        </div>

        <div>
          <p className="text-muted-foreground text-sm">Requested Scopes</p>
          <p className="font-mono text-sm">{scope || 'openid'}</p>
        </div>

        <p className="text-muted-foreground text-sm">
          This application wants to access your Upflow data.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleConsent(true)}
            className="bg-primary text-primary-foreground flex-1 rounded-md px-4 py-2 font-medium"
          >
            Allow
          </button>
          <button
            type="button"
            onClick={() => handleConsent(false)}
            className="flex-1 rounded-md border px-4 py-2 font-medium"
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  )
}
