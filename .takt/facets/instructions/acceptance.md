# Acceptance Testing Procedure

Verify that the implementation meets the completion criteria of the task spec (order.md).

## Steps

1. Trust the upstream validation routing.

   The `implement` step (and `fix` step on the failure path) only routes
   to `acceptance` after `pnpm validate` passed and wrote the result into
   `implement-report.md`. Re-running `pnpm validate` here would just
   repeat the same work — and on this repo it has caused two real
   problems:
   - `edit: false` mismatch: this step runs in read-only mode, but
     `pnpm validate` writes `build/` and `.react-router/types/`,
     which can fail with `Operation not permitted` in the sandbox.
   - Loop amplification: re-running validate has flakiness windows
     (ts-morph contention, transient test failures) that bounced the
     `acceptance ↔ fix` loop up to its threshold even when the code
     was correct (see issue #399 family).

   Read `implement-report.md`'s `## Validation` section and quote the
   summary. If it says validation passed, treat it as passed.

2. List all completion criteria from order.md and judge each one Yes/No
   by reading the relevant code and verifying the implementation against
   the criterion. If No, describe the specific deficiency.

3. If the task involves DB schema changes, confirm that
   `implement-report.md` reports `pnpm db:setup` success. Do not re-run
   it here.

4. Scope check:
   - Get the list of changed files with `git diff --name-only HEAD`
   - Cross-reference with the files to change listed in order.md
   - Check for any out-of-scope changes (refer to prohibited actions in
     the policy)

5. Judgment:
   - All completion criteria Yes + upstream validation passed -> approved
   - Otherwise -> needs_fix (include specific fix instructions)
