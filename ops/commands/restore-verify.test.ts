import Database from 'better-sqlite3'
import { mkdtempSync } from 'node:fs'
import { access, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  collectTenantNamesFromCommonPrefixes,
  computeFinalExit,
  extractImmediateChildDbName,
  loadR2ReplicaConfigFromLitestreamYml,
  runRestoreVerifyCore,
  runRestoreVerifyOrchestrated,
  type RestoreVerifyDeps,
  type RestoreVerifyOrchestrationDeps,
} from './restore-verify'

const repoRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)
const litestreamYmlPath = path.join(repoRoot, 'litestream.yml')

function testEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LITESTREAM_REPLICA_PREFIX: 'production/litestream',
    AWS_ACCESS_KEY_ID: 'test-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    AWS_ENDPOINT_URL_S3: 'https://example.r2.cloudflarestorage.com',
    AWS_REGION: 'auto',
  } as NodeJS.ProcessEnv
}

function voidLog(): RestoreVerifyDeps['log'] {
  return {
    info: () => {},
    error: () => {},
  }
}

describe('extractImmediateChildDbName', () => {
  it('returns immediate child db folder name', () => {
    expect(
      extractImmediateChildDbName(
        'production/litestream/tenant_a.db/',
        'production/litestream',
      ),
    ).toBe('tenant_a.db')
  })

  it('rejects nested paths', () => {
    expect(
      extractImmediateChildDbName(
        'production/litestream/foo/bar/x.db/',
        'production/litestream',
      ),
    ).toBeNull()
  })

  it('rejects unrelated prefix', () => {
    expect(
      extractImmediateChildDbName(
        'other/pfx/tenant_a.db/',
        'production/litestream',
      ),
    ).toBeNull()
  })
})

describe('collectTenantNamesFromCommonPrefixes', () => {
  it('keeps tenant dbs, drops data, durably, non-tenant, dedupes', () => {
    const prefixes = [
      'production/litestream/tenant_a.db/',
      'production/litestream/tenant_a.db/',
      'production/litestream/data.db/',
      'production/litestream/durably.db/',
      'production/litestream/other.db/',
      'production/litestream/tenant_b.db/',
    ]
    expect(
      collectTenantNamesFromCommonPrefixes(prefixes, 'production/litestream'),
    ).toEqual(['tenant_a.db', 'tenant_b.db'])
  })
})

describe('loadR2ReplicaConfigFromLitestreamYml', () => {
  it('reads bucket and resolves replica prefix from env', () => {
    const cfg = loadR2ReplicaConfigFromLitestreamYml(
      litestreamYmlPath,
      testEnv(),
    )
    expect(cfg.bucket).toBe('upflow-backups')
    expect(cfg.replicaPrefix).toBe('production/litestream')
  })

  it('fails with missing env for path template', () => {
    expect(() =>
      loadR2ReplicaConfigFromLitestreamYml(litestreamYmlPath, {
        AWS_ACCESS_KEY_ID: 'x',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/replica path/)
  })
})

describe('computeFinalExit', () => {
  it('prefers signal over work failure and cleanup failure', () => {
    expect(
      computeFinalExit({
        signalExit: 130,
        workExit: 1,
        cleanupFailed: true,
      }),
    ).toBe(130)
  })

  it('preserves work failure when cleanup fails', () => {
    expect(
      computeFinalExit({
        signalExit: null,
        workExit: 1,
        cleanupFailed: true,
      }),
    ).toBe(1)
  })

  it('returns 1 when only cleanup failed', () => {
    expect(
      computeFinalExit({
        signalExit: null,
        workExit: 0,
        cleanupFailed: true,
      }),
    ).toBe(1)
  })
})

describe('runRestoreVerifyCore', () => {
  it('returns 1 when litestream is missing', async () => {
    const code = await runRestoreVerifyCore(
      {
        litestreamYmlPath,
        env: testEnv(),
        log: voidLog(),
        join: path.join,
        ensureLitestreamAvailable: () => {
          throw new Error(
            'litestream CLI not found. Install with: brew install benbjohnson/litestream/litestream',
          )
        },
        listTenantDbs: () => Promise.resolve([]),
        runLitestreamRestore: () => Promise.resolve(),
        countTableRows: () => 0,
      },
      {
        workDir: tmpdir(),
        signal: new AbortController().signal,
        getSignalExit: () => null,
      },
    )
    expect(code).toBe(1)
  })

  it('returns 0 when restore and counts succeed', async () => {
    const workDir = mkdtempSync(path.join(tmpdir(), 'upflow-rv-core-success-'))
    const code = await runRestoreVerifyCore(
      {
        litestreamYmlPath,
        env: testEnv(),
        log: voidLog(),
        join: path.join,
        ensureLitestreamAvailable: () => {},
        listTenantDbs: () => Promise.resolve(['tenant_x.db']),
        runLitestreamRestore: ({ outputPath }) => {
          const db = new Database(outputPath)
          try {
            if (outputPath.endsWith('data.db')) {
              db.exec(`
                create table organizations (id text);
                create table members (id text);
                create table integrations (id text);
                insert into organizations values ('1');
                insert into members values ('1');
                insert into integrations values ('1');
              `)
            } else {
              db.exec(`
                create table organization_settings (id text);
                create table repositories (id text);
                create table pull_requests (id text);
                insert into organization_settings values ('1');
                insert into repositories values ('1');
                insert into pull_requests values ('1');
              `)
            }
          } finally {
            db.close()
          }
          return Promise.resolve()
        },
        countTableRows: (dbPath, table) => {
          const db = new Database(dbPath, { readonly: true })
          try {
            const row = db
              .prepare(`select count(*) as c from "${table}"`)
              .get() as { c: number }
            return row.c
          } finally {
            db.close()
          }
        },
      },
      {
        workDir,
        signal: new AbortController().signal,
        getSignalExit: () => null,
      },
    )
    expect(code).toBe(0)
    await rm(workDir, { recursive: true, force: true })
  })

  it('returns 1 when a required shared table is unreadable', async () => {
    const workDir = mkdtempSync(
      path.join(tmpdir(), 'upflow-rv-core-missing-table-'),
    )
    const code = await runRestoreVerifyCore(
      {
        litestreamYmlPath,
        env: testEnv(),
        log: voidLog(),
        join: path.join,
        ensureLitestreamAvailable: () => {},
        listTenantDbs: () => Promise.resolve([]),
        runLitestreamRestore: ({ outputPath }) => {
          if (!outputPath.endsWith('data.db')) return Promise.resolve()
          const db = new Database(outputPath)
          try {
            db.exec(`
              create table organizations (id text);
              create table members (id text);
              insert into organizations values ('1');
              insert into members values ('1');
            `)
          } finally {
            db.close()
          }
          return Promise.resolve()
        },
        countTableRows: (dbPath, table) => {
          const db = new Database(dbPath, { readonly: true })
          try {
            const row = db
              .prepare(`select count(*) as c from "${table}"`)
              .get() as { c: number }
            return row.c
          } finally {
            db.close()
          }
        },
      },
      {
        workDir,
        signal: new AbortController().signal,
        getSignalExit: () => null,
      },
    )
    expect(code).toBe(1)
    await rm(workDir, { recursive: true, force: true })
  })
})

describe('runRestoreVerifyOrchestrated', () => {
  it('removes work dir after tenant discovery failure', async () => {
    const created: string[] = []
    const ac = new AbortController()
    const deps: RestoreVerifyOrchestrationDeps = {
      litestreamYmlPath,
      env: testEnv(),
      log: voidLog(),
      join: path.join,
      ensureLitestreamAvailable: () => {},
      listTenantDbs: () =>
        Promise.reject(new Error('list failed intentionally')),
      runLitestreamRestore: () => Promise.resolve(),
      countTableRows: () => 0,
      createWorkDir: () => {
        const d = mkdtempSync(path.join(tmpdir(), 'upflow-rv-orch-fail-'))
        created.push(d)
        return d
      },
      removeWorkDir: (dir) => rm(dir, { recursive: true, force: true }),
    }

    const code = await runRestoreVerifyOrchestrated(deps, {
      signal: ac.signal,
      getSignalExit: () => null,
    })
    expect(code).toBe(1)
    expect(created.length).toBe(1)
    const workDirPath = created[0]
    if (workDirPath === undefined) throw new Error('expected work dir')
    await expect(access(workDirPath)).rejects.toThrow()
  })
})

/*
 * SIGINT/SIGTERM: handlers call AbortController.abort and set exit 130/143 in
 * restoreVerifyCommand() before computeFinalExit(); full process integration is
 * left to manual runs of `pnpm ops restore-verify`.
 */
