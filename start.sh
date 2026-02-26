#!/bin/sh

# This file is how Fly starts the server (configured in fly.toml). Before starting
# the server though, we need to run any Atlas migrations that haven't yet been
# run, which is why this file exists in the first place.
# Learn more: https://community.fly.io/t/sqlite-not-getting-setup-properly/4386

set -ex

DB_URL='sqlite:///upflow/data/data.db'

# Check if atlas_schema_revisions table exists (Atlas migration history)
if ! sqlite3 /upflow/data/data.db "SELECT 1 FROM atlas_schema_revisions LIMIT 1" 2>/dev/null; then
  echo "Setting Atlas baseline for existing database..."
  atlas migrate set 20251224122040 --env local --url "$DB_URL"
fi

# 1. Apply shared DB migrations
atlas migrate apply --env local --url "$DB_URL"

# 2. One-time data migration: split tenant data from shared DB into per-org tenant DBs
#    Only runs if old tenant tables still exist in the shared DB
if sqlite3 /upflow/data/data.db "SELECT 1 FROM organization_settings LIMIT 1" 2>/dev/null; then
  echo "Old tenant tables detected. Running data migration..."
  node build/db/migrate-to-tenant.js
fi

# 3. Apply tenant migrations to all existing tenant DBs
node build/db/apply-tenant-migrations.js

node server.mjs
