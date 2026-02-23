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

atlas migrate apply --env local --url "$DB_URL"

# Data migration: ensure every org has at least one owner member
# This handles the transition from pre-membership schema
sqlite3 /upflow/data/data.db "
INSERT INTO members (id, organization_id, user_id, role, created_at)
SELECT lower(hex(randomblob(10))), o.id, u.id, 'owner', datetime('now')
FROM organizations o
CROSS JOIN users u
WHERE u.role = 'admin'
AND NOT EXISTS (
  SELECT 1 FROM members m WHERE m.organization_id = o.id
);
"

node server.mjs
