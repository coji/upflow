import { expect, test } from 'vitest'
import { createForwardedRequest } from './forwarded-request'

test('forwarded-request https ヘッダなし', () => {
  const req = new Request('https://example.com/foo')
  const forwardedReq = createForwardedRequest(req)
  expect(forwardedReq.url).toBe('https://example.com/foo')
})

test('forwarded-request http x-forwarded-host ヘッダあり', () => {
  const req = new Request('http://example.com/foo', {
    headers: { 'x-forwarded-host': 'test.example.com' },
  })
  const forwardedReq = createForwardedRequest(req)
  expect(forwardedReq.url).toBe('http://test.example.com/foo')
})

test('forwarded-request https x-forwarded-proto ヘッダあり', () => {
  const req = new Request('https://example.com/foo', {
    headers: { 'x-forwarded-proto': 'https' },
  })
  const forwardedReq = createForwardedRequest(req)
  expect(forwardedReq.url).toBe('https://example.com/foo')
})

test('forwarded-request http x-forwarded-proto ヘッダあり', () => {
  const req = new Request('http://example.com/foo', {
    headers: { 'x-forwarded-proto': 'https' },
  })
  const forwardedReq = createForwardedRequest(req)
  expect(forwardedReq.url).toBe('https://example.com/foo')
})

test('forwarded-request https x-forwarded-proto, x-forwarded-host ヘッダあり', () => {
  const req = new Request('https://example.com/foo?name=coji#a', {
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'test.example.com',
    },
  })
  const forwardedReq = createForwardedRequest(req)
  expect(forwardedReq.url).toBe('https://test.example.com/foo?name=coji#a')
})

test('forwarded-request http x-forwarded-proto ヘッダあり', () => {
  const req = new Request('http://example.com/foo', {
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'test.example.com',
    },
  })
  const forwardedReq = createForwardedRequest(req)
  expect(forwardedReq.url).toBe('https://test.example.com/foo')
})
