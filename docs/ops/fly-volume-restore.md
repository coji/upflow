# Fly Volume Restore

This note records the current production volume backup posture and the tested
restore path for the `upflow` Fly app.

Continuous SQLite replication to Cloudflare R2 is documented separately in
[Litestream R2 Backup](./litestream-r2.md). Fly volume snapshots remain the
volume-level fallback for this runbook.

## Current State

As of 2026-04-25:

- App: `upflow`
- Region: `nrt`
- Production volume: `vol_vlpd30e1ey731zg4`
- Volume name: `data`
- Size: `2GB`
- Mounted machine: `48ed667c733018`
- Scheduled snapshots: enabled
- Snapshot retention: `30` days

The retention was changed from the Fly default of `5` days to `30` days on
2026-04-25.

These values are time-sensitive. Before using this runbook during an incident,
verify the current app, volume, machine, snapshot, and retention state with the
Fly commands below.

## Snapshot Checks

List the production volume and confirm retention:

```bash
fly volumes show vol_vlpd30e1ey731zg4 -a upflow
```

List available snapshots:

```bash
fly volumes snapshots list vol_vlpd30e1ey731zg4 -a upflow
```

Create a manual snapshot when needed:

```bash
fly volumes snapshots create vol_vlpd30e1ey731zg4 -a upflow
```

## Restore Rehearsal

Snapshot restore was rehearsed on 2026-04-25 by creating a temporary volume
from snapshot `vs_KxRlzkJ2epvcyNxb6ykb6gm`.

The snapshot and temporary volume IDs in this section are historical values from
the 2026-04-25 rehearsal. Do not reuse them without checking the current Fly
state.

Command used:

```bash
fly volumes create data_restore_rehearsal \
  -a upflow \
  -r nrt \
  -s 2 \
  --snapshot-id vs_KxRlzkJ2epvcyNxb6ykb6gm \
  --snapshot-retention 1 \
  --yes
```

The restored volume reached `created` state:

```text
vol_vxmwk8dwky6lnxn4 created data_restore_rehearsal 2GB nrt
```

The temporary volume was then deleted:

```bash
fly volumes destroy vol_vxmwk8dwky6lnxn4 -a upflow --yes
```

This rehearsal confirms that Fly can create a new volume from the production
volume snapshots. It does not validate attaching the restored volume to a
replacement machine or booting the app from it.

## Full Restore Drill Result

The full restore drill was run on 2026-04-25 in a separate Fly app.

Resources used:

- Restore-test app: `upflow-restore-test`
- Restore-test machine: `d891226a334338`
- Production snapshot: `vs_N1poYn20AVyI0ZkeY1mZ209`
- Restored volume: `vol_vp2zzkllzx6zn824`
- Restored volume app: `upflow-restore-test`
- Restored volume name: `data`
- Restored volume region: `nrt`
- Restored volume size: `2GB`
- Restore-test URL: `https://upflow-restore-test.fly.dev`

Commands used:

```bash
fly apps create upflow-restore-test --org personal

fly volumes snapshots create vol_vlpd30e1ey731zg4 -a upflow

fly volumes create data \
  -a upflow-restore-test \
  -r nrt \
  -s 2 \
  --snapshot-id vs_N1poYn20AVyI0ZkeY1mZ209 \
  --snapshot-retention 1 \
  --yes

fly secrets set -a upflow-restore-test --stage \
  BETTER_AUTH_URL=https://upflow-restore-test.fly.dev \
  BETTER_AUTH_SECRET=<production value> \
  GITHUB_CLIENT_ID=<production value> \
  GITHUB_CLIENT_SECRET=<production value> \
  DISABLE_JOB_SCHEDULER=1

fly deploy -a upflow-restore-test --primary-region nrt --ha=false --now
```

Validated:

- The restore-test app booted from the restored volume.
- `start.sh` ran against the restored DB copy.
- Shared DB migration completed.
- Tenant DB migration completed with `0 applied, 3 skipped`.
- `/healthcheck` returned `OK`.
- GitHub OAuth login worked after adding the restore-test callback URL to the
  GitHub OAuth app used by `GITHUB_CLIENT_ID`.
- The main app screen could read restored data after login.
- `DISABLE_JOB_SCHEDULER=1` prevented the hourly crawl scheduler from starting.
- Logs showed no crawl cycle, webhook, export, or Google Sheets write activity
  during the drill.

DB checks:

```text
data.db
durably.db
tenant_aScaf_RvvFiOJWD3m8X32.db
tenant_iris.db
tenant_o-7OumR2NCGWpqsDgT--k.db
```

Shared DB counts:

```text
organizations|3
members|13
integrations|3
```

Tenant DB counts:

```text
tenant_aScaf_RvvFiOJWD3m8X32.db
organization_settings|1
repositories|12
pull_requests|751

tenant_iris.db
organization_settings|1
repositories|36
pull_requests|4204

tenant_o-7OumR2NCGWpqsDgT--k.db
organization_settings|1
repositories|2
pull_requests|8909
```

Cleanup:

- `fly apps destroy upflow-restore-test --yes` was run after the drill.
- `fly status -a upflow-restore-test` and
  `fly volumes list -a upflow-restore-test` both returned `Could not find App`,
  confirming the restore-test app, machine, volume, and Fly secrets were
  removed.
- The restore-test callback URL was removed from the GitHub OAuth app:
  `https://upflow-restore-test.fly.dev/api/auth/callback/github`

## Full Restore Drill Plan

Issue: <https://github.com/coji/upflow/issues/319>

Run the full drill in a separate Fly app, for example `upflow-restore-test`, to
avoid attaching restored production data to the live app.

Important constraints:

- GitHub OAuth login can be included in the separate app drill when the GitHub
  App user authorization callback URL includes the restore-test callback, for
  example `https://upflow-restore-test.fly.dev/api/auth/callback/github`.
- The restore-test app must set `BETTER_AUTH_URL` to the same origin as the
  registered callback URL, for example `https://upflow-restore-test.fly.dev`.
- Use the same GitHub App `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as
  production only for the duration of the drill. Remove temporary app secrets or
  the temporary callback URL after the drill if they are no longer needed.
- Writes and external side effects must be disabled before booting the restored
  app: scheduler, crawl/classify/process jobs, webhooks, exports, and Google
  Sheets writes.
- Set `DISABLE_JOB_SCHEDULER=1` on the restore-test app before booting it. This
  prevents the production hourly crawl scheduler from starting.
- Run the normal startup migration path against the restored copy. The restored
  volume is disposable; the production volume must not be modified.
- Recovery point objective is the latest available Fly snapshot, so settings,
  members, and integration metadata can roll back by up to about one day.
  GitHub-derived data can be recrawled after recovery.

Minimum checks for the full drill:

1. Create a restore-test Fly app.
2. Create a volume from a production snapshot and mount it at `/upflow/data`.
3. Add the restore-test callback URL to the GitHub App if it is not already
   present.
4. Set restore-test secrets, including `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`, and `DISABLE_JOB_SCHEDULER=1`.
5. Boot the app with side effects disabled.
6. Verify `/healthcheck`.
7. Log in through GitHub OAuth with an account that exists as an active GitHub
   user in the restored tenant data.
8. Confirm the main app screen can read restored data after login.
9. Confirm shared DB tables can be read, especially `organizations`, `members`,
   and `integrations`.
10. Confirm tenant DB tables can be read, especially `organization_settings`,
    `repositories`, and `pull_requests`.
11. Confirm background jobs and external write paths are not running.
12. Delete the temporary app and restored volume, or record why they were kept.
13. Remove the restore-test callback URL from the GitHub App when the drill is
    complete, unless it is intentionally retained for future drills.

## Emergency Restore Outline

1. Stop writes by scaling the app down or preventing traffic.
2. List snapshots for `vol_vlpd30e1ey731zg4`.
3. Create a new `data` volume from the selected snapshot in `nrt`.
4. Attach or deploy a replacement machine using the restored volume.
5. Start the app and verify `/healthcheck`.
6. Check recent organization crawl state before declaring recovery complete.

Do not destroy the original production volume until the restored app has been
verified.

Example command templates. Replace placeholders and re-check live Fly state
before execution.

```bash
# Confirm current production volume state and retention.
fly volumes show vol_vlpd30e1ey731zg4 -a upflow

# List snapshots for the production volume.
fly volumes snapshots list vol_vlpd30e1ey731zg4 -a upflow

# Create a restored data volume from the selected snapshot.
fly volumes create data \
  -a upflow \
  -r nrt \
  -s 2 \
  --snapshot-id <SNAPSHOT_ID> \
  --yes

# Deploy or create the replacement machine in the same app and region.
# Choose the exact command based on the current Fly machine/app state.
fly deploy -a upflow --region nrt
```
