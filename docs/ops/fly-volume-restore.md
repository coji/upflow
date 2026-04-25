# Fly Volume Restore

This note records the current production volume backup posture and the tested
restore path for the `upflow` Fly app.

## Current State

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

## Full Restore Drill Plan

Issue: <https://github.com/coji/upflow/issues/319>

Run the full drill in a separate Fly app, for example `upflow-restore-test`, to
avoid attaching restored production data to the live app.

Important constraints:

- GitHub OAuth login is out of scope for the separate app drill because the
  current GitHub OAuth app has a single callback URL.
- The drill should validate database restore, migrations, and read access
  without normal user login.
- Writes and external side effects must be disabled before booting the restored
  app: scheduler, crawl/classify/process jobs, webhooks, exports, and Google
  Sheets writes.
- Run the normal startup migration path against the restored copy. The restored
  volume is disposable; the production volume must not be modified.
- Recovery point objective is the latest available Fly snapshot, so settings,
  members, and integration metadata can roll back by up to about one day.
  GitHub-derived data can be recrawled after recovery.

Minimum checks for the full drill:

1. Create a restore-test Fly app.
2. Create a volume from a production snapshot and mount it at `/upflow/data`.
3. Boot the app with side effects disabled.
4. Verify `/healthcheck`.
5. Confirm shared DB tables can be read, especially `organizations`, `members`,
   and `integrations`.
6. Confirm tenant DB tables can be read, especially `organization_settings`,
   `repositories`, and `pull_requests`.
7. Confirm background jobs and external write paths are not running.
8. Delete the temporary app and restored volume, or record why they were kept.

## Emergency Restore Outline

1. Stop writes by scaling the app down or preventing traffic.
2. List snapshots for `vol_vlpd30e1ey731zg4`.
3. Create a new `data` volume from the selected snapshot in `nrt`.
4. Attach or deploy a replacement machine using the restored volume.
5. Start the app and verify `/healthcheck`.
6. Check recent organization crawl state before declaring recovery complete.

Do not destroy the original production volume until the restored app has been
verified.
