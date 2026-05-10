```markdown
# RDD Draft Result

## RDD Draft: CREATED / BLOCKED

Judgment criteria:

- CREATED: Draft was written to `docs/rdd/issue-<N>-<slug>.md` with the
  required structure and the `DRAFT` marker. Human review is the next step.
- BLOCKED: Cannot draft. Examples:
  - Issue body is empty or too vague to derive a design judgment
  - Existing code contradicts the issue premise in a way that needs
    spec-level discussion before any RDD can be drafted
  - Required external context (referenced doc, prior RDD, related PR) is
    inaccessible

## Output Path

`docs/rdd/issue-<N>-<slug>.md`

## Slug Rationale

{Why this slug was chosen — issue title summary -> kebab-case mapping}

## Code References Used

List the `file:line` citations that grounded the draft. The reviewer uses
these to spot-check that the draft reflects current code.

- `path/to/file.ts:NN` — {what the citation supports}
- ...

## Open Questions Surfaced

The "Open Questions" section of the RDD lists points that need human
judgment. Summarize them here so the reviewer can prioritize.

- {Question 1 — why it matters}
- {Question 2 — why it matters}

## Notes

{Anything the human reviewer should know that doesn't fit elsewhere.
Caveats, ambiguity in the issue, references that were considered but
not used. Leave empty if none.}

## Why (if BLOCKED)

{One short paragraph naming the specific blocker. The reviewer reads this
first to decide whether the issue needs revision before retrying.}
```
