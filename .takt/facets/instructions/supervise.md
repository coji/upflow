# Final Verification Procedure

Verify the overall consistency of the implementation and determine whether it can be completed.

## Steps

1. Trust the upstream validation routing.

   The simplify step (and fix step on the failure path) only routes to
   `supervise` when `pnpm validate` passed. Re-running `pnpm validate`
   here would just repeat the same work — and on this repo `pnpm test`
   contends on ts-morph initialization across vitest workers, which has
   silently hung the supervise Bash tool past takt's stream-idle
   timeout (issue #399, 2026-05-09). Read `implement-report.md` and
   (if present) `acceptance-report.md` for the validation summary
   instead of re-executing.

2. List all completion criteria from order.md and check the status of
   each (cross-reference `acceptance-report.md`).

3. Check changed files with `git diff --name-only HEAD`:
   - Any out-of-scope changes?
   - Has order.md or PLAN.md been modified?

4. If an acceptance testing report exists, review any remaining issues.

5. Judgment:
   - All completion criteria met + upstream validation passed -> ready to complete
   - Only minor remaining issues -> issue fix instructions and route to fix
   - Spec-level issues -> route back to spec-review
