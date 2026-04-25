# Litestream R2 Backup

upflow backs up SQLite databases to Cloudflare R2 with Litestream.

## Scope

Litestream is enabled only when `LITESTREAM_ENABLED=1`.

The production config replicates two classes of SQLite database:

- `data.db` — shared DB (organizations, members, integrations, githubAppLinks). Low write rate, tight RPO.
- `tenant_*.db` — per-org analytics. Picked up dynamically via directory watch when new orgs are added.

`durably.db` is **intentionally excluded** from replication. It holds in-flight `@coji/durably` job orchestration state, which Litestream would persist as roughly one level-0 LTX file per transaction — at hourly crawl cadence that accounts for about half of all R2 Class A operations. The data is regenerable: GitHub is the source of truth, and the next hourly crawl re-derives state via idempotent upserts. Worst-case loss on restore is whatever job was in flight at the moment of disaster, which the scheduler picks up on its next tick. Skipping durably keeps R2 PUT volume comfortably inside the free tier with headroom for organization growth.

## R2 Bucket

Bucket:

```text
upflow-backups
```

Production prefix:

```text
production/litestream
```

The bucket is private. Do not enable public access.

Create and confirm the bucket via wrangler. `pnpm dlx` fetches wrangler on demand so it does not need to live in `devDependencies`:

```bash
pnpm dlx wrangler login
pnpm dlx wrangler r2 bucket create upflow-backups
pnpm dlx wrangler r2 bucket list
```

## R2 Credentials

Create an R2 API token for the `upflow-backups` bucket.

Use Object Read & Write permissions. Do not add Delete permission for v1. The committed Litestream config disables active remote retention cleanup:

```yaml
retention:
  enabled: false
```

This keeps credentials from being able to delete backups. Use R2 lifecycle rules later if remote cleanup becomes necessary.

Set these Fly secrets:

```bash
fly secrets set \
  LITESTREAM_ENABLED=1 \
  AWS_ACCESS_KEY_ID=... \
  AWS_SECRET_ACCESS_KEY=... \
  AWS_ENDPOINT_URL_S3=https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  AWS_REGION=auto \
  LITESTREAM_REPLICA_PREFIX=production/litestream \
  -a upflow
```

Do not print the secret values in logs or issue comments.

## Deploy Order

The app startup order is:

1. Apply shared DB migrations.
2. Migrate integration data to the shared DB.
3. Apply tenant DB migrations.
4. Start `litestream replicate -exec "node server.mjs"` when `LITESTREAM_ENABLED=1`.

Litestream starts after successful migrations. If migration fails, the app does not start. If the app exits, Litestream exits too.

## Verification

After deploy, check logs:

```bash
fly logs -a upflow
```

Look for Litestream startup and database discovery logs. Confirm R2 has objects under:

```text
upflow-backups/production/litestream/
```

Each replicated database appears as its own subprefix, for example:

```text
production/litestream/data.db/
production/litestream/tenant_iris.db/
```

A `production/litestream/durably.db/` prefix may exist as a remnant from earlier runs that replicated `durably.db`. It is no longer updated and can be cleaned up with an R2 lifecycle rule (see "Stale durably.db Cleanup" below) — credentials in production lack Delete permission by design, so the rule, not Litestream, is responsible for removal.

## Stale durably.db Cleanup

If R2 contains a `production/litestream/durably.db/` prefix from before durably was excluded, set up a lifecycle rule to expire it. Cloudflare Dashboard → R2 → `upflow-backups` → Settings → Object lifecycle rules:

- Prefix: `production/litestream/durably.db/`
- Action: **Delete objects** after `7 days` (or any short retention; the prefix is stale and will not get new writes)

The rest of the bucket is left untouched — Litestream manages its own LTX retention via compaction levels for the active databases.

## Restore Smoke Test

Run restore tests into a temporary directory. Never restore over `/upflow/data` on production.

For directory-replication configs (this repo's setup), pass the replica URL directly. Litestream reads the R2 credentials from `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_ENDPOINT_URL_S3` / `AWS_REGION`, so `-config` is not needed and the runbook works on any machine with those env vars set:

```bash
mkdir -p /tmp/upflow-litestream-restore

litestream restore \
  -o /tmp/upflow-litestream-restore/data.db \
  s3://upflow-backups/production/litestream/data.db

sqlite3 /tmp/upflow-litestream-restore/data.db \
  "select count(*) from organizations; select count(*) from members; select count(*) from integrations;"
```

For tenant DBs, replace the replica path and output filename:

```bash
litestream restore \
  -o /tmp/upflow-litestream-restore/tenant_iris.db \
  s3://upflow-backups/production/litestream/tenant_iris.db

sqlite3 /tmp/upflow-litestream-restore/tenant_iris.db \
  "select count(*) from organization_settings; select count(*) from repositories; select count(*) from pull_requests;"
```

The restore command refuses to overwrite an existing output file. Delete the temporary restored file before re-running.

## Restore-Test App

For a fuller drill, create a temporary Fly app and volume as in the [Fly volume restore runbook](./fly-volume-restore.md), but set:

```bash
fly secrets set \
  DISABLE_JOB_SCHEDULER=1 \
  LITESTREAM_ENABLED=0 \
  -a <restore-test-app>
```

Restore the DB files into that app's data directory only after stopping crawl jobs and confirming the target app is not production.

## References

- https://litestream.io/reference/config/
- https://litestream.io/reference/replicate/
- https://litestream.io/reference/restore/
- https://litestream.io/guides/s3-compatible/
