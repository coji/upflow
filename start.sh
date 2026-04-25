#!/bin/sh

# This file is how Fly starts the server (configured in fly.toml). Before starting
# the server though, we need to run any Atlas migrations that haven't yet been
# run, which is why this file exists in the first place.
# Learn more: https://community.fly.io/t/sqlite-not-getting-setup-properly/4386

set -e

# 1. Apply shared DB migrations
set -x
atlas migrate apply --env local --url "sqlite://${UPFLOW_DATA_DIR}/data.db"

# 2. Migrate integrations data from tenant DBs to shared DB (idempotent, safe to re-run)
node build/db/migrate-integrations-to-shared.js

# 3. Apply tenant migrations to all existing tenant DBs
node build/db/apply-tenant-migrations.js
set +x

# Load Sentry before server (same as pnpm start). No-op when SENTRY_DSN is unset.
export NODE_OPTIONS="--import ./instrument.server.mjs${NODE_OPTIONS:+ $NODE_OPTIONS}"

if [ "${LITESTREAM_ENABLED:-0}" = "1" ]; then
  : "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required when LITESTREAM_ENABLED=1}"
  : "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required when LITESTREAM_ENABLED=1}"
  : "${AWS_ENDPOINT_URL_S3:?AWS_ENDPOINT_URL_S3 is required when LITESTREAM_ENABLED=1}"
  : "${AWS_REGION:?AWS_REGION is required when LITESTREAM_ENABLED=1}"
  : "${LITESTREAM_REPLICA_PREFIX:?LITESTREAM_REPLICA_PREFIX is required when LITESTREAM_ENABLED=1}"

  exec litestream replicate -config "${LITESTREAM_CONFIG:-/etc/litestream.yml}" -exec "node server.mjs"
fi

exec node server.mjs
