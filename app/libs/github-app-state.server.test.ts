import SQLite from 'better-sqlite3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { closeDb } from '~/app/services/db.server'
import { toOrgId } from '~/app/types/organization'
import {
  claimInstallStateForUser,
  consumeAuthorizedInstallState,
  consumeAuthorizedInstallStateDetailed,
  generateInstallState,
  getAuthorizedInstallStateOrganization,
  getInstallStateTarget,
  InstallStateError,
  releaseConsumedInstallState,
} from './github-app-state.server'

const testDir = path.join(tmpdir(), `github-app-state-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')
const rawInit = new SQLite(testDbPath)
rawInit.exec(`
  CREATE TABLE organizations (
    id text NOT NULL PRIMARY KEY, name text NOT NULL, slug text NOT NULL
  );
  CREATE TABLE users (id text NOT NULL PRIMARY KEY);
  CREATE TABLE members (
    id text NOT NULL PRIMARY KEY, organization_id text NOT NULL,
    user_id text NOT NULL, role text NOT NULL
  );
  CREATE TABLE accounts (
    id text NOT NULL PRIMARY KEY, account_id text NOT NULL,
    provider_id text NOT NULL, user_id text NOT NULL
  );
  CREATE TABLE github_app_install_states (
    id text NOT NULL PRIMARY KEY, organization_id text NOT NULL,
    nonce text NOT NULL, created_by_user_id text NULL,
    claimed_by_user_id text NULL, expires_at text NOT NULL,
    claimed_at text NULL, intent_kind text NOT NULL DEFAULT 'direct', consumed_at text NULL,
    created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
  CREATE UNIQUE INDEX github_app_install_states_nonce_key
    ON github_app_install_states (nonce);
  CREATE TABLE github_app_links (
    organization_id text NOT NULL, installation_id integer NOT NULL,
    deleted_at text NULL, PRIMARY KEY (organization_id, installation_id)
  );
`)
rawInit.close()
vi.stubEnv('UPFLOW_DATA_DIR', path.dirname(testDbPath))

describe('github-app-state', () => {
  const orgId = toOrgId('org-1')

  afterAll(async () => {
    await closeDb()
    vi.unstubAllEnvs()
  })

  beforeEach(async () => {
    await closeDb()
    const raw = new SQLite(testDbPath)
    raw.exec(`
      DELETE FROM github_app_install_states;
      DELETE FROM github_app_links;
      DELETE FROM accounts; DELETE FROM members; DELETE FROM users;
      DELETE FROM organizations;
    `)
    raw
      .prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)')
      .run(orgId, 'Organization One', 'org-one')
    raw.prepare('INSERT INTO users (id) VALUES (?)').run('user-1')
    raw
      .prepare('INSERT INTO members VALUES (?, ?, ?, ?)')
      .run('member-1', orgId, 'user-1', 'owner')
    raw
      .prepare('INSERT INTO accounts VALUES (?, ?, ?, ?)')
      .run('account-1', 'github-user-1', 'github', 'user-1')
    raw.close()
  })

  test('direct installation consumes its nonce for the creating user', async () => {
    const nonce = await generateInstallState(orgId, 'user-1')
    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        nonce,
        userId: 'user-1',
      }),
    ).resolves.toEqual({ organizationId: orgId })
  })

  test('exposes a live direct states organization only to its creator', async () => {
    const nonce = await generateInstallState(orgId, 'user-1')
    await expect(
      getAuthorizedInstallStateOrganization(nonce, 'user-1'),
    ).resolves.toBe(orgId)
    await expect(
      getAuthorizedInstallStateOrganization(nonce, 'someone-else'),
    ).resolves.toBeNull()
  })

  test('a direct nonce cannot be consumed by a different signed-in user', async () => {
    const nonce = await generateInstallState(orgId, 'user-1')
    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        nonce,
        userId: 'someone-else',
      }),
    ).rejects.toThrow(InstallStateError)
  })

  test('shows the target organization before a delegated intent is claimed', async () => {
    const nonce = await generateInstallState(orgId, 'user-1', 'handoff')
    await expect(getInstallStateTarget(nonce, 'delegate')).resolves.toEqual({
      organizationName: 'Organization One',
      organizationSlug: 'org-one',
    })
  })

  test('state-less recovery consumes a recent intent for the signed-in owner', async () => {
    await generateInstallState(orgId, 'user-1')
    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        userId: 'user-1',
      }),
    ).resolves.toEqual({ organizationId: orgId })
  })

  test('state-less recovery does not consume a newer copied handoff URL', async () => {
    await generateInstallState(orgId, 'user-1')
    const handoffNonce = await generateInstallState(orgId, 'user-1', 'handoff')

    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        userId: 'user-1',
      }),
    ).resolves.toEqual({ organizationId: orgId })
    await expect(
      getInstallStateTarget(handoffNonce, 'delegate'),
    ).resolves.toEqual({
      organizationName: 'Organization One',
      organizationSlug: 'org-one',
    })
  })

  test('a new direct intent replaces the same users previous recovery attempt', async () => {
    const oldNonce = await generateInstallState(orgId, 'user-1')
    const newNonce = await generateInstallState(orgId, 'user-1')
    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        nonce: oldNonce,
        userId: 'user-1',
      }),
    ).rejects.toThrow(InstallStateError)
    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        nonce: newNonce,
        userId: 'user-1',
      }),
    ).resolves.toEqual({ organizationId: orgId })
  })

  test('a direct intent for another organization preserves the first flow', async () => {
    const otherOrgId = toOrgId('org-2')
    const firstNonce = await generateInstallState(orgId, 'user-1')
    const raw = new SQLite(testDbPath)
    raw
      .prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)')
      .run(otherOrgId, 'Organization Two', 'org-two')
    raw
      .prepare(
        'UPDATE github_app_install_states SET created_at = ? WHERE organization_id = ?',
      )
      .run('2026-01-01T00:00:00.000Z', orgId)
    raw.close()

    await generateInstallState(otherOrgId, 'user-1')
    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        nonce: firstNonce,
        userId: 'user-1',
      }),
    ).resolves.toEqual({ organizationId: orgId })
  })

  test('state-less recovery rejects direct intents across organizations', async () => {
    const otherOrgId = toOrgId('org-2')
    await generateInstallState(orgId, 'user-1')
    const raw = new SQLite(testDbPath)
    raw
      .prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)')
      .run(otherOrgId, 'Organization Two', 'org-two')
    raw.close()

    await new Promise((resolve) => setTimeout(resolve, 2))
    await generateInstallState(otherOrgId, 'user-1')
    await expect(
      consumeAuthorizedInstallState({ installationId: 7, userId: 'user-1' }),
    ).rejects.toThrow(
      'More than one organization has a pending GitHub App connection',
    )
  })

  test('release does not revive a direct intent retired by a newer attempt', async () => {
    const firstNonce = await generateInstallState(orgId, 'user-1')
    const consumed = await consumeAuthorizedInstallStateDetailed({
      installationId: 7,
      nonce: firstNonce,
      userId: 'user-1',
    })
    const newerNonce = await generateInstallState(orgId, 'user-1')
    const raw = new SQLite(testDbPath)
    raw
      .prepare('UPDATE github_app_install_states SET created_at = ?')
      .run('2026-07-16T00:00:00.000Z')
    raw.close()

    await releaseConsumedInstallState(consumed.stateId)

    await expect(
      consumeAuthorizedInstallState({
        installationId: 8,
        nonce: firstNonce,
        userId: 'user-1',
      }),
    ).rejects.toThrow(InstallStateError)
    await expect(
      consumeAuthorizedInstallState({
        installationId: 8,
        nonce: newerNonce,
        userId: 'user-1',
      }),
    ).resolves.toEqual({ organizationId: orgId })
  })

  test('release restores the current direct intent after a same-millisecond failure', async () => {
    await generateInstallState(orgId, 'user-1')
    const nonce = await generateInstallState(orgId, 'user-1')
    const consumed = await consumeAuthorizedInstallStateDetailed({
      installationId: 7,
      nonce,
      userId: 'user-1',
    })

    await releaseConsumedInstallState(consumed.stateId)

    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        nonce,
        userId: 'user-1',
      }),
    ).resolves.toEqual({ organizationId: orgId })
  })

  test('generating an intent for another organization preserves delegated URLs', async () => {
    const otherOrgId = toOrgId('org-2')
    const oldNonce = await generateInstallState(orgId, 'user-1', 'handoff')
    const raw = new SQLite(testDbPath)
    raw
      .prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)')
      .run(otherOrgId, 'Organization Two', 'org-two')
    raw
      .prepare('INSERT INTO members VALUES (?, ?, ?, ?)')
      .run('member-2', otherOrgId, 'user-1', 'owner')
    raw.close()

    await generateInstallState(otherOrgId, 'user-1')
    await claimInstallStateForUser(oldNonce, 'delegate')

    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        nonce: oldNonce,
        userId: 'delegate',
      }),
    ).resolves.toEqual({ organizationId: orgId })
  })

  test('copying another URL preserves in-flight handoffs for the same organization', async () => {
    const oldNonce = await generateInstallState(orgId, 'user-1', 'handoff')
    const newNonce = await generateInstallState(orgId, 'user-1', 'handoff')

    await expect(getInstallStateTarget(oldNonce, 'delegate')).resolves.toEqual({
      organizationName: 'Organization One',
      organizationSlug: 'org-one',
    })
    await expect(getInstallStateTarget(newNonce, 'delegate')).resolves.toEqual({
      organizationName: 'Organization One',
      organizationSlug: 'org-one',
    })
  })

  test('state-less recovery ignores an abandoned old intent', async () => {
    await generateInstallState(orgId, 'user-1')
    const raw = new SQLite(testDbPath)
    raw
      .prepare('UPDATE github_app_install_states SET created_at = ?')
      .run('2000-01-01T00:00:00Z')
    raw.close()

    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        userId: 'user-1',
      }),
    ).rejects.toThrow(InstallStateError)
  })

  test('a different user cannot consume an unclaimed state-less recovery', async () => {
    await generateInstallState(orgId, 'user-1')
    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        userId: 'someone-else',
      }),
    ).rejects.toThrow(InstallStateError)
  })

  test('expired nonce is rejected', async () => {
    const nonce = await generateInstallState(orgId, 'user-1')
    const raw = new SQLite(testDbPath)
    raw
      .prepare('UPDATE github_app_install_states SET expires_at = ?')
      .run('2000-01-01T00:00:00Z')
    raw.close()

    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        nonce,
      }),
    ).rejects.toThrow(InstallStateError)
  })

  test('a migrated legacy state is invalidated because it has no author binding', async () => {
    const raw = new SQLite(testDbPath)
    raw
      .prepare(`
        INSERT INTO github_app_install_states
          (id, organization_id, nonce, intent_kind, expires_at)
        VALUES (?, ?, ?, 'legacy', ?)
      `)
      .run(
        'legacy-state',
        orgId,
        'legacy-nonce',
        new Date(Date.now() + 60_000).toISOString(),
      )
    raw.close()

    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        nonce: 'legacy-nonce',
        userId: 'delegate',
      }),
    ).rejects.toThrow(
      'This install link predates delegated authorization. Start the connection again',
    )
  })

  test('a migrated legacy state is excluded from state-less recovery', async () => {
    const raw = new SQLite(testDbPath)
    raw
      .prepare(`
        INSERT INTO github_app_install_states
          (id, organization_id, nonce, intent_kind, expires_at)
        VALUES (?, ?, ?, 'legacy', ?)
      `)
      .run(
        'legacy-state',
        orgId,
        'legacy-nonce',
        new Date(Date.now() + 60_000).toISOString(),
      )
    raw.close()

    await expect(
      consumeAuthorizedInstallState({ installationId: 7, userId: 'user-1' }),
    ).rejects.toThrow(InstallStateError)
  })

  test('copied install link transfers its nonce to the recipient', async () => {
    await generateInstallState(orgId, 'user-1', 'handoff')
    const raw = new SQLite(testDbPath)
    const { nonce } = raw
      .prepare('SELECT nonce FROM github_app_install_states')
      .get() as { nonce: string }
    raw.prepare('INSERT INTO users (id) VALUES (?)').run('delegate')
    raw.close()

    await claimInstallStateForUser(nonce, 'delegate')

    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        nonce,
        userId: 'delegate',
      }),
    ).resolves.toEqual({ organizationId: orgId })
  })

  test('trims a copied nonce before claiming it', async () => {
    const nonce = await generateInstallState(orgId, 'user-1', 'handoff')

    await expect(
      claimInstallStateForUser(`  ${nonce}  `, 'delegate'),
    ).resolves.toBeUndefined()

    await expect(getInstallStateTarget(nonce, 'delegate')).resolves.toEqual({
      organizationName: 'Organization One',
      organizationSlug: 'org-one',
    })
  })

  test('state-less recovery accepts a recent copied URL claimed by the signed-in recipient', async () => {
    const nonce = await generateInstallState(orgId, 'user-1', 'handoff')
    await claimInstallStateForUser(nonce, 'delegate')

    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        userId: 'delegate',
      }),
    ).resolves.toEqual({ organizationId: orgId })
  })

  test('state-less recovery uses handoff claim time rather than URL creation time', async () => {
    const nonce = await generateInstallState(orgId, 'user-1', 'handoff')
    const raw = new SQLite(testDbPath)
    raw
      .prepare('UPDATE github_app_install_states SET created_at = ?')
      .run('2000-01-01T00:00:00Z')
    raw.close()

    await claimInstallStateForUser(nonce, 'delegate')

    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        userId: 'delegate',
      }),
    ).resolves.toEqual({ organizationId: orgId })
  })

  test('a different user cannot consume a claimed copied URL by nonce', async () => {
    const nonce = await generateInstallState(orgId, 'user-1', 'handoff')
    await claimInstallStateForUser(nonce, 'delegate')

    await expect(
      consumeAuthorizedInstallState({
        installationId: 7,
        nonce,
        userId: 'someone-else',
      }),
    ).rejects.toThrow(InstallStateError)
  })

  test('a claimed copied URL remains usable by the same recipient until callback', async () => {
    const nonce = await generateInstallState(orgId, 'user-1', 'handoff')
    await claimInstallStateForUser(nonce, 'delegate')

    await expect(getInstallStateTarget(nonce, 'delegate')).resolves.toEqual({
      organizationName: 'Organization One',
      organizationSlug: 'org-one',
    })
    await expect(
      claimInstallStateForUser(nonce, 'delegate'),
    ).resolves.toBeUndefined()
  })
})
