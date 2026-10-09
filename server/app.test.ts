import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import { createApp } from './app.mjs'

const setup = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'server-app-'))
  const publicDir = path.join(root, 'public')
  const clientDir = path.join(root, 'client')
  mkdirSync(publicDir)
  mkdirSync(path.join(clientDir, 'assets'), { recursive: true })
  writeFileSync(path.join(publicDir, 'robots.txt'), 'User-agent: *')
  writeFileSync(path.join(clientDir, 'assets', 'entry-abc123.js'), 'x')

  const handler = vi.fn(
    async (request: Request) =>
      new Response(`${request.method} ${request.url}`, {
        headers: { 'Content-Type': 'text/html' },
      }),
  )
  const app = createApp({ handler, publicDir, clientDir })
  return { app, handler }
}

vi.spyOn(console, 'log').mockImplementation(() => {})

describe('createApp', () => {
  test('passes the request URL through to the React Router handler', async () => {
    const { app } = setup()
    const res = await app.request('https://upflow.example.com/org?tab=1')
    expect(await res.text()).toBe('GET https://upflow.example.com/org?tab=1')
  })

  test('adds HSTS and region headers to handler responses', async () => {
    const { app } = setup()
    const res = await app.request('/org')
    expect(res.headers.get('Strict-Transport-Security')).toMatch(
      /^max-age=\d+$/,
    )
    expect(res.headers.get('x-fly-region')).toBeTruthy()
  })

  test('redirects a trailing slash with 301 and keeps the query', async () => {
    const { app, handler } = setup()
    const res = await app.request('/org/settings/?tab=1')
    expect(res.status).toBe(301)
    expect(res.headers.get('Location')).toBe('/org/settings?tab=1')
    expect(res.headers.get('Strict-Transport-Security')).toBeTruthy()
    expect(handler).not.toHaveBeenCalled()
  })

  test('collapses repeated slashes in the redirect target', async () => {
    const { app } = setup()
    const res = await app.request('//org//settings/')
    expect(res.headers.get('Location')).toBe('/org/settings')
  })

  test('serves build assets as immutable', async () => {
    const { app, handler } = setup()
    const res = await app.request('/assets/entry-abc123.js')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    )
    expect(handler).not.toHaveBeenCalled()
  })

  test('serves public files with a one hour cache', async () => {
    const { app } = setup()
    const res = await app.request('/robots.txt')
    expect(await res.text()).toBe('User-agent: *')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600')
  })

  test('does not answer a POST with a static file', async () => {
    const { app, handler } = setup()
    const res = await app.request('/robots.txt', { method: 'POST' })
    expect(await res.text()).toBe('POST http://localhost/robots.txt')
    expect(handler).toHaveBeenCalledOnce()
  })

  test('does not compress server-sent events', async () => {
    const app = createApp({
      handler: async () =>
        new Response('data: x\n\n'.repeat(500), {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    })
    const res = await app.request('/events', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    expect(res.headers.get('Content-Encoding')).toBeNull()
  })

  test('compresses large HTML responses', async () => {
    const app = createApp({
      handler: async () =>
        new Response('<p>x</p>'.repeat(500), {
          headers: { 'Content-Type': 'text/html' },
        }),
    })
    const res = await app.request('/org', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    expect(res.headers.get('Content-Encoding')).toBe('gzip')
  })
})
