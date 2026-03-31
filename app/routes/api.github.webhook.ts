import { verifyWebhookSignature } from '~/app/libs/webhook-verify.server'
import { processGithubWebhookPayload } from '~/app/services/github-webhook.server'
import type { Route } from './+types/api.github.webhook'

export const loader = () => {
  return new Response('Method Not Allowed', { status: 405 })
}

export const action = async ({ request }: Route.ActionArgs) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('X-Hub-Signature-256') ?? ''
  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const event = request.headers.get('X-GitHub-Event')

  try {
    await processGithubWebhookPayload(event, payload)
  } catch (e) {
    console.error('[github webhook]', e)
    return new Response('Webhook processing failed', { status: 500 })
  }

  return new Response(null, { status: 204 })
}
