# Final Verification Procedure

Verify the overall consistency of the implementation and determine whether it can be completed.

## Steps

1. List all completion criteria from order.md and check the status of each

2. Run validation:

   ```bash
   pnpm validate
   ```

3. If the task involves DB schema changes, also run:

   ```bash
   pnpm db:setup
   ```

4. Check changed files with `git diff --name-only`:
   - Are there any out-of-scope changes?
   - Have order.md or PLAN.md been modified?

5. If an acceptance testing report exists, review any remaining issues

6. Judgment:
   - All completion criteria met + validation passes -> ready to complete
   - Only minor remaining issues -> issue fix instructions and route to fix
   - Spec-level issues -> route back to spec-review
