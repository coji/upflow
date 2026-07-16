import { Form, redirect } from 'react-router'
import { getSession } from '~/app/libs/auth.server'
import {
  claimInstallStateForUser,
  getInstallStateTarget,
  InstallStateError,
} from '~/app/libs/github-app-state.server'
import { getGithubAppSlug } from '~/app/services/github-octokit.server'
import type { Route } from './+types/api.github.install'

function installError(error: unknown): never {
  if (error instanceof InstallStateError) {
    throw new Response(
      `${error.message}. Ask the Upflow organization owner for a new install URL.`,
      { status: 400 },
    )
  }
  throw error
}

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url)
  const state = url.searchParams.get('state')?.trim()
  if (!state) throw new Response('Missing install state', { status: 400 })

  const session = await getSession(request)
  if (!session?.user) {
    const redirectTo = url.pathname + url.search
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`)
  }

  try {
    const target = await getInstallStateTarget(state, session.user.id)
    return { state, ...target }
  } catch (error) {
    installError(error)
  }
}

export const action = async ({ request }: Route.ActionArgs) => {
  const session = await getSession(request)
  if (!session?.user)
    throw new Response('Authentication required', { status: 401 })

  const formData = await request.formData()
  const state = formData.get('state')
  if (typeof state !== 'string' || !state.trim()) {
    throw new Response('Missing install state', { status: 400 })
  }

  const slug = await getGithubAppSlug()
  if (!slug) throw new Response('GitHub App is not configured', { status: 503 })

  try {
    await claimInstallStateForUser(state, session.user.id)
  } catch (error) {
    installError(error)
  }

  throw redirect(
    `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`,
  )
}

export default function ConfirmGithubInstall({
  loaderData,
}: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Connect GitHub App</h1>
      <p>
        You are about to connect a GitHub App installation to the Upflow
        organization <strong>{loaderData.organizationName}</strong> (
        {loaderData.organizationSlug}).
      </p>
      <p>
        Continue only if you recognize and intend to connect this organization.
      </p>
      <Form method="post">
        <input type="hidden" name="state" value={loaderData.state} />
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 font-medium text-white"
        >
          Continue to GitHub
        </button>
      </Form>
    </main>
  )
}
