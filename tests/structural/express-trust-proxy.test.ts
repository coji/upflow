import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Structural test: server.mjs must trust the Fly proxy so req.protocol/host
// reflect the public origin. React Router v8 rejects document POSTs whose
// Origin header doesn't match the server-side request URL ("Bad Request").
// Fly terminates TLS and forwards plain HTTP, so without trust proxy every
// browser form submission (login included) fails behind the proxy while
// header-less clients like curl keep working.

const ROOT = path.resolve(__dirname, '../..')

describe('express trust proxy', () => {
  it('server.mjs enables trust proxy', () => {
    const source = readFileSync(path.join(ROOT, 'server.mjs'), 'utf-8')
    expect(source).toMatch(/app\.set\(['"]trust proxy['"]\s*,\s*1\)/)
  })
})
