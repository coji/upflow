# Litestream R2 Backup

upflow backs up SQLite databases to Cloudflare R2 with Litestream.

## Scope

Litestream is enabled only when `LITESTREAM_ENABLED=1`.

The production config watches `${UPFLOW_DATA_DIR}` and replicates every SQLite database matching `*.db`, including:

- `data.db`
- `durably.db`
- `tenant_*.db`

New tenant databases are picked up by Litestream directory watch.

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

The directory replica appends each database filename under the prefix, for example:

```text
production/litestream/data.db/
production/litestream/durably.db/
production/litestream/tenant_iris.db/
```

## Restore Smoke Test

Run restore tests into a temporary directory. Never restore over `/upflow/data` on production.

Inside a machine with Litestream and the R2 credentials available:

```bash
mkdir -p /tmp/upflow-litestream-restore

litestream restore \
  -config /etc/litestream.yml \
  -o /tmp/upflow-litestream-restore/data.db \
  /upflow/data/data.db

sqlite3 /tmp/upflow-litestream-restore/data.db \
  "select count(*) from organizations; select count(*) from members; select count(*) from integrations;"
```

For tenant DBs, replace the source and output filename:

```bash
litestream restore \
  -config /etc/litestream.yml \
  -o /tmp/upflow-litestream-restore/tenant_iris.db \
  /upflow/data/tenant_iris.db

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
