```markdown
# Implementation Result

## Implement: COMPLETED / BLOCKED

Judgment criteria:

- COMPLETED: Implementation is done. All files listed in order.md's
  "files to change" have been modified as intended. The workflow can
  safely proceed to acceptance.
- BLOCKED: Cannot complete the implementation. Examples:
  - order.md is missing required information (file path, schema, API
    contract) and cannot be inferred from the codebase
  - The required change conflicts with existing code in a way that
    needs spec-level discussion (not a simple code fix)
  - A required external resource (API, library, secret) is unavailable
  - Honest dead-end. Use BLOCKED when continuing would mean guessing
    or writing throwaway code.

Do NOT use BLOCKED for:

- "validation occasionally fails under load" — the implementation is
  done; surface the caveat in Notes and emit COMPLETED.
- "tests are flaky" — same as above; emit COMPLETED with a Notes entry.
- "I am not 100% sure my fix is correct" — emit COMPLETED. Acceptance
  step exists for this.

## Summary

{1-2 sentence summary of what was implemented (or why blocked)}

## Files Changed

- `path/to/file.ts` — {brief description of change}
- ...

## Validation

Summary of `pnpm validate` output. If the run had any flakiness or
caveats (intermittent failure, slow test, etc.), capture them in
Notes below — NOT in the Judgment.

## Notes

{Anything the next step (acceptance / human reviewer) should know
that doesn't fit elsewhere. Caveats, observed flakiness, decisions
made under ambiguity. Leave empty if none.}

## Why (if BLOCKED)

{One short paragraph naming the specific blocker. The acceptance
step will not run; this text is what the human reviewer reads first.}
```
