import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Structural test: the env keys symphony's container reads at boot
// (declared in `infra/symphony/fly.toml [env]`) MUST also be passed to
// the local preflight image (declared in
// `infra/symphony/preflight-local.sh` `ENV_ARGS`). Otherwise the local
// check passes against a different env set than production runs with
// — exactly the failure mode that prompted PR #405 in the first place.
//
// Replace this when the duplication gets DRY'd up (single env source
// loaded by both fly.toml and the preflight script).

const ROOT = path.resolve(__dirname, '../..')

// Keys that intentionally only live in fly.toml — they're consumed by
// image-time defaults or by the symphony server itself, not by anything
// that runs inside the preflight chain (pnpm install / db:setup /
// typecheck), so the local check doesn't need them.
const FLY_ONLY_KEYS = new Set([
  'HOME', // set by Dockerfile ENV; preflight inherits via image
  'SYMPHONY_REPO_DIR', // bin/symphony-serve.ts only
  'PORT', // server bind port; preflight runs no server
])

// Keys whose values come from `flyctl secrets set` in production (see
// docs/symphony-setup.md §2) instead of fly.toml. They're stubbed in
// the local preflight script with dummy values so the env presence
// check passes there too. Kept out of fly.toml to avoid normalising
// secret-named plaintext in committed config.
const SECRET_VIA_FLY_SECRETS = new Set([
  'BETTER_AUTH_SECRET',
  'GITHUB_CLIENT_SECRET',
])

function readFlyTomlEnvKeys(): Set<string> {
  const content = readFileSync(
    path.join(ROOT, 'infra/symphony/fly.toml'),
    'utf-8',
  )
  const keys = new Set<string>()
  let inEnv = false
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // Stop at the next `[` table header.
    if (inEnv && trimmed.startsWith('[')) inEnv = false
    if (trimmed === '[env]') {
      inEnv = true
      continue
    }
    if (!inEnv) continue
    // Match `KEY = "value"` lines, ignore comments and blanks.
    const m = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*"/)
    if (m) keys.add(m[1])
  }
  return keys
}

function readPreflightScriptEnvKeys(): Set<string> {
  const content = readFileSync(
    path.join(ROOT, 'infra/symphony/preflight-local.sh'),
    'utf-8',
  )
  const keys = new Set<string>()
  for (const line of content.split('\n')) {
    // Match `  -e KEY=value` inside the ENV_ARGS array.
    const m = line.match(/^\s*-e\s+([A-Z][A-Z0-9_]*)=/)
    if (m) keys.add(m[1])
  }
  return keys
}

describe('symphony fly.toml [env] mirrors preflight-local.sh ENV_ARGS', () => {
  const flyKeys = readFlyTomlEnvKeys()
  const scriptKeys = readPreflightScriptEnvKeys()

  it(`scans at least one key from each side (fly=${flyKeys.size} script=${scriptKeys.size})`, () => {
    expect(flyKeys.size).toBeGreaterThan(0)
    expect(scriptKeys.size).toBeGreaterThan(0)
  })

  it('every preflight-relevant fly.toml [env] key is also in preflight-local.sh', () => {
    const missing = [...flyKeys]
      .filter((k) => !FLY_ONLY_KEYS.has(k))
      .filter((k) => !scriptKeys.has(k))
    expect(
      missing,
      `Missing from preflight-local.sh ENV_ARGS: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('every preflight-local.sh ENV_ARGS key is either in fly.toml [env] or in fly secrets', () => {
    const missing = [...scriptKeys]
      .filter((k) => !flyKeys.has(k))
      .filter((k) => !SECRET_VIA_FLY_SECRETS.has(k))
    expect(
      missing,
      `Missing from fly.toml [env] (and not in SECRET_VIA_FLY_SECRETS): ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('every fly secrets-bound key is stubbed in preflight-local.sh', () => {
    const missing = [...SECRET_VIA_FLY_SECRETS].filter(
      (k) => !scriptKeys.has(k),
    )
    expect(
      missing,
      `Missing from preflight-local.sh ENV_ARGS: ${missing.join(', ')}`,
    ).toEqual([])
  })
})
