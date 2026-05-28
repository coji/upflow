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

# exec so node receives SIGINT/SIGTERM directly (Fly kill_signal = SIGINT).
# Disaster recovery is handled by Fly volume snapshots; see docs/ops/fly-volume-restore.md.
exec node server.mjs
