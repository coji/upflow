/**
 * Restore-verify CLI: see docs/ops/litestream-r2.md → "Programmatic restore verification".
 */
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import Database from 'better-sqlite3'
import consola from 'consola'
import { execFile as execFileCallback, execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { parse as parseYaml } from 'yaml'
import { getErrorMessageForLog } from '~/app/libs/error-message'

const execFileAsync = promisify(execFileCallback)

const RESTORE_VERIFY_WORKDIR_PREFIX = '/tmp/upflow-restore-verify-'

const LITESTREAM_INSTALL_HINT = 'brew install benbjohnson/litestream/litestream'

const DATA_DB = 'data.db'
const DURABLY_DB = 'durably.db'

const REQUIRED_AWS_ENV = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_ENDPOINT_URL_S3',
  'AWS_REGION',
] as const

const SHARED_TABLES = ['organizations', 'members', 'integrations'] as const
const TENANT_TABLES = [
  'organization_settings',
  'repositories',
  'pull_requests',
] as const

export type RestoreVerifyDeps = {
  litestreamYmlPath: string
  env: NodeJS.ProcessEnv
  log: {
    info: (msg: string) => void
    error: (msg: string) => void
  }
  join: typeof path.join
  ensureLitestreamAvailable: () => void
  listTenantDbs: (
    bucket: string,
    replicaPrefix: string,
    signal: AbortSignal,
  ) => Promise<string[]>
  runLitestreamRestore: (args: {
    replicaUrl: string
    outputPath: string
    signal: AbortSignal
  }) => Promise<void>
  countTableRows: (dbPath: string, table: string) => number
}

export type RestoreVerifyOrchestrationDeps = RestoreVerifyDeps & {
  createWorkDir: () => string
  removeWorkDir: (dir: string) => Promise<void>
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function replicaUrl(
  bucket: string,
  replicaPrefix: string,
  dbName: string,
): string {
  return `s3://${bucket}/${replicaPrefix}/${dbName}`
}

export function computeFinalExit(options: {
  signalExit: 130 | 143 | null
  workExit: number
  cleanupFailed: boolean
}): number {
  if (options.signalExit !== null) return options.signalExit
  if (options.workExit !== 0) return options.workExit
  if (options.cleanupFailed) return 1
  return 0
}

function interpolateTemplate(
  template: string,
  env: NodeJS.ProcessEnv,
): { ok: true; value: string } | { ok: false; missing: string[] } {
  const missing: string[] = []
  const value = template.replace(/\$\{([^}]+)\}/g, (_full, key: string) => {
    const v = env[key]
    if (v === undefined || v === '') {
      if (!missing.includes(key)) missing.push(key)
      return ''
    }
    return v
  })
  if (missing.length > 0) return { ok: false, missing }
  return { ok: true, value }
}

function missingKeys(
  env: NodeJS.ProcessEnv,
  keys: readonly string[],
): string[] {
  return keys.filter((k) => {
    const v = env[k]
    return v === undefined || v === ''
  })
}

type LitestreamYamlRoot = {
  dbs?: unknown
}

export function extractImmediateChildDbName(
  commonPrefix: string,
  replicaPrefixNoTrailingSlash: string,
): string | null {
  const prefix = commonPrefix.replace(/\/$/, '')
  const base = replicaPrefixNoTrailingSlash.replace(/\/$/, '')
  if (!prefix.startsWith(`${base}/`)) return null
  const rest = prefix.slice(base.length + 1)
  if (rest.includes('/')) return null
  return rest.length > 0 ? rest : null
}

/** Collects tenant `*.db` names from ListObjectsV2 `CommonPrefixes` (deduped, sorted). */
export function collectTenantNamesFromCommonPrefixes(
  commonPrefixes: string[],
  replicaPrefix: string,
): string[] {
  const base = replicaPrefix.replace(/\/$/, '')
  const seen = new Set<string>()
  const out: string[] = []
  for (const cp of commonPrefixes) {
    const name = extractImmediateChildDbName(cp, base)
    if (!name || name === DATA_DB || name === DURABLY_DB) continue
    if (!/^tenant_.*\.db$/.test(name)) continue
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out.sort()
}

function extractS3Replica(
  entry: unknown,
): { bucket: string; path: string } | null {
  if (!entry || typeof entry !== 'object') return null
  const replica = (entry as { replica?: unknown }).replica
  if (!replica || typeof replica !== 'object') return null
  const r = replica as { type?: unknown; bucket?: unknown; path?: unknown }
  if (r.type !== 's3') return null
  if (typeof r.bucket !== 'string' || typeof r.path !== 'string') return null
  return { bucket: r.bucket, path: r.path }
}

export function loadR2ReplicaConfigFromLitestreamYml(
  litestreamYmlPath: string,
  env: NodeJS.ProcessEnv,
): { bucket: string; replicaPrefix: string } {
  const raw = readFileSync(litestreamYmlPath, 'utf-8')
  const doc = parseYaml(raw) as unknown
  if (!doc || typeof doc !== 'object') {
    throw new Error('Invalid litestream.yml: root must be an object')
  }
  const dbs = (doc as LitestreamYamlRoot).dbs
  if (!Array.isArray(dbs) || dbs.length === 0) {
    throw new Error('Invalid litestream.yml: dbs must be a non-empty array')
  }

  let bucket: string | undefined
  let pathTemplate: string | undefined

  for (const entry of dbs) {
    const r = extractS3Replica(entry)
    if (!r) continue
    if (bucket === undefined) {
      bucket = r.bucket
      pathTemplate = r.path
    } else if (bucket !== r.bucket || pathTemplate !== r.path) {
      throw new Error(
        'Invalid litestream.yml: all S3 replicas must share the same bucket and path template',
      )
    }
  }

  if (!bucket || !pathTemplate) {
    throw new Error(
      'Invalid litestream.yml: no S3 replica entry with string bucket and path',
    )
  }

  const bucketInterp = interpolateTemplate(bucket, env)
  if (!bucketInterp.ok) {
    throw new Error(
      `Missing required environment variable(s) for replica bucket: ${bucketInterp.missing.join(', ')}`,
    )
  }

  const pathInterp = interpolateTemplate(pathTemplate, env)
  if (!pathInterp.ok) {
    throw new Error(
      `Missing required environment variable(s) for replica path: ${pathInterp.missing.join(', ')}`,
    )
  }

  const replicaPrefix = pathInterp.value.replace(/\/$/, '')
  return { bucket: bucketInterp.value, replicaPrefix }
}

export function createS3ListTenantDbs(
  env: NodeJS.ProcessEnv,
): RestoreVerifyDeps['listTenantDbs'] {
  return async (bucket, replicaPrefix, signal) => {
    const accessKeyId = env.AWS_ACCESS_KEY_ID
    const secretAccessKey = env.AWS_SECRET_ACCESS_KEY
    const endpoint = env.AWS_ENDPOINT_URL_S3
    const region = env.AWS_REGION
    if (!accessKeyId || !secretAccessKey || !endpoint || !region) {
      throw new Error(
        'createS3ListTenantDbs: missing AWS credential env (internal error)',
      )
    }

    const client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    })

    const listPrefix = replicaPrefix.endsWith('/')
      ? replicaPrefix
      : `${replicaPrefix}/`
    const gathered: string[] = []
    let continuationToken: string | undefined

    do {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: listPrefix,
          Delimiter: '/',
          ContinuationToken: continuationToken,
        }),
        { abortSignal: signal },
      )
      for (const cp of response.CommonPrefixes ?? []) {
        const p = cp.Prefix
        if (p) gathered.push(p)
      }
      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined
    } while (continuationToken)

    return collectTenantNamesFromCommonPrefixes(gathered, replicaPrefix)
  }
}

export function defaultEnsureLitestreamAvailable(): void {
  try {
    execFileSync('litestream', ['version'], {
      stdio: 'pipe',
      encoding: 'utf-8',
    })
  } catch {
    throw new Error(
      `litestream CLI not found. Install with: ${LITESTREAM_INSTALL_HINT}`,
    )
  }
}

export async function defaultRunLitestreamRestore(args: {
  replicaUrl: string
  outputPath: string
  signal: AbortSignal
}): Promise<void> {
  await execFileAsync(
    'litestream',
    ['restore', '-o', args.outputPath, args.replicaUrl],
    {
      maxBuffer: 10 * 1024 * 1024,
      signal: args.signal,
    },
  )
}

export function defaultCountTableRows(dbPath: string, table: string): number {
  const db = new Database(dbPath, { readonly: true })
  try {
    const row = db.prepare(`select count(*) as c from "${table}"`).get() as {
      c: number
    }
    return row.c
  } finally {
    db.close()
  }
}

export function createDefaultRestoreDeps(options: {
  litestreamYmlPath: string
  env?: NodeJS.ProcessEnv
  log: RestoreVerifyDeps['log']
}): RestoreVerifyDeps {
  const env = options.env ?? process.env
  return {
    litestreamYmlPath: options.litestreamYmlPath,
    env,
    log: options.log,
    join: path.join,
    ensureLitestreamAvailable: defaultEnsureLitestreamAvailable,
    listTenantDbs: createS3ListTenantDbs(env),
    runLitestreamRestore: defaultRunLitestreamRestore,
    countTableRows: defaultCountTableRows,
  }
}

export async function runRestoreVerifyCore(
  deps: RestoreVerifyDeps,
  options: {
    workDir: string
    signal: AbortSignal
    getSignalExit: () => 130 | 143 | null
  },
): Promise<number> {
  const { workDir, signal, getSignalExit } = options
  const { log } = deps

  try {
    deps.ensureLitestreamAvailable()
  } catch (e) {
    log.error(getErrorMessageForLog(e))
    return 1
  }

  let config: { bucket: string; replicaPrefix: string }
  try {
    config = loadR2ReplicaConfigFromLitestreamYml(
      deps.litestreamYmlPath,
      deps.env,
    )
  } catch (e) {
    log.error(getErrorMessageForLog(e))
    return 1
  }

  const awsMissing = missingKeys(deps.env, REQUIRED_AWS_ENV)
  if (awsMissing.length > 0) {
    log.error(
      `Missing required environment variable(s): ${awsMissing.join(', ')}`,
    )
    return 1
  }

  let tenants: string[]
  try {
    log.info(
      `Tenant discovery: listing under s3://${config.bucket}/${config.replicaPrefix}/`,
    )
    tenants = await deps.listTenantDbs(
      config.bucket,
      config.replicaPrefix,
      signal,
    )
    log.info(
      `Tenant discovery complete: ${tenants.length} database(s): ${tenants.join(', ') || '(none)'}`,
    )
  } catch (e) {
    if (isAbortError(e)) return getSignalExit() ?? 130
    log.error(`Tenant discovery failed: ${getErrorMessageForLog(e)}`)
    return 1
  }

  type RestoreTarget = {
    name: string
    outPath: string
    replicaUrl: string
    tables: readonly string[]
  }
  const targets: RestoreTarget[] = [
    {
      name: DATA_DB,
      outPath: deps.join(workDir, DATA_DB),
      replicaUrl: replicaUrl(config.bucket, config.replicaPrefix, DATA_DB),
      tables: SHARED_TABLES,
    },
    ...tenants.map((tenant) => ({
      name: tenant,
      outPath: deps.join(workDir, tenant),
      replicaUrl: replicaUrl(config.bucket, config.replicaPrefix, tenant),
      tables: TENANT_TABLES,
    })),
  ]

  for (const t of targets) {
    const interrupt = getSignalExit()
    if (interrupt) return interrupt
    try {
      log.info(`Restore start: ${t.name} (replica ${t.replicaUrl})`)
      await deps.runLitestreamRestore({
        replicaUrl: t.replicaUrl,
        outputPath: t.outPath,
        signal,
      })
      log.info(`Restore complete: ${t.name} -> ${t.outPath}`)
    } catch (e) {
      if (isAbortError(e)) return getSignalExit() ?? 130
      log.error(
        `Restore failed for ${t.name} (replica ${t.replicaUrl}): ${getErrorMessageForLog(e)}`,
      )
      return 1
    }
  }

  for (const t of targets) {
    const interrupt = getSignalExit()
    if (interrupt) return interrupt
    for (const table of t.tables) {
      try {
        const n = deps.countTableRows(t.outPath, table)
        log.info(`Table count: ${t.name} / ${table} = ${n}`)
      } catch (e) {
        log.error(
          `Table count failed: ${t.name} / ${table}: ${getErrorMessageForLog(e)}`,
        )
        return 1
      }
    }
  }

  return 0
}

export async function runRestoreVerifyOrchestrated(
  deps: RestoreVerifyOrchestrationDeps,
  options: {
    signal: AbortSignal
    getSignalExit: () => 130 | 143 | null
  },
): Promise<number> {
  let workDir: string | undefined
  let workExit = 0
  let cleanupFailed = false

  try {
    workDir = deps.createWorkDir()
    workExit = await runRestoreVerifyCore(deps, {
      workDir,
      signal: options.signal,
      getSignalExit: options.getSignalExit,
    })
  } catch (e) {
    deps.log.error(getErrorMessageForLog(e))
    workExit = 1
  } finally {
    if (workDir) {
      try {
        await deps.removeWorkDir(workDir)
        deps.log.info(`Cleanup completed: removed ${workDir}`)
      } catch (e) {
        cleanupFailed = true
        deps.log.error(
          `Cleanup failed for ${workDir}: ${getErrorMessageForLog(e)}`,
        )
      }
    }
  }

  return computeFinalExit({
    signalExit: options.getSignalExit(),
    workExit,
    cleanupFailed,
  })
}

function defaultLitestreamYmlPath(): string {
  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'litestream.yml',
  )
}

export async function restoreVerifyCommand(): Promise<number> {
  const abortController = new AbortController()
  let signalExit: 130 | 143 | null = null

  const onSigint = () => {
    signalExit = 130
    abortController.abort()
  }
  const onSigterm = () => {
    signalExit = 143
    abortController.abort()
  }

  process.once('SIGINT', onSigint)
  process.once('SIGTERM', onSigterm)

  try {
    const baseDeps = createDefaultRestoreDeps({
      litestreamYmlPath: defaultLitestreamYmlPath(),
      log: {
        info: (msg) => {
          consola.info(msg)
        },
        error: (msg) => {
          consola.error(msg)
        },
      },
    })

    const orchestrationDeps: RestoreVerifyOrchestrationDeps = {
      ...baseDeps,
      createWorkDir: () => mkdtempSync(RESTORE_VERIFY_WORKDIR_PREFIX),
      removeWorkDir: (dir) => rm(dir, { recursive: true, force: true }),
    }

    return await runRestoreVerifyOrchestrated(orchestrationDeps, {
      signal: abortController.signal,
      getSignalExit: () => signalExit,
    })
  } finally {
    process.removeListener('SIGINT', onSigint)
    process.removeListener('SIGTERM', onSigterm)
  }
}
