```markdown
# RDD Draft Result

## RDD Draft: CREATED / BLOCKED

Judgment criteria:

- CREATED: Draft was written to `docs/rdd/issue-<N>-<slug>.md` per
  `docs/rdd/README.md` の 推奨構成, with the DRAFT marker present, and the
  Draft Quality Check below shows no failures (or all failures are
  explained). Human review is the next step.
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

## Draft Quality Check

Self-evaluate against `docs/rdd/README.md` の「Draft 品質ゲート」 section.
Mark each item Yes/No. The human reviewer uses this as the entry-condition
to substantive review: any No needs to be addressed (or explicitly accepted
as a known limitation) before the draft is read for design content.

| #   | Gate                                                                                                                                      | Result |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | DRAFT marker present at the top of the RDD                                                                                                | Yes/No |
| 2   | `### 設計判断` の「採らなかった代案」が 2 案以上ある                                                                                      | Yes/No |
| 3   | `### 現状実装の確認` に file:line 引用がある                                                                                              | Yes/No |
| 4   | `### Open Questions` が非空                                                                                                               | Yes/No |
| 5   | `### 受け入れ条件` に **実装後の検証可能な挙動のみ** が含まれている (RDD 自己構造チェック / 実装手順 / code snippet / 曖昧表現を含まない) | Yes/No |

If any item is No, name the item and briefly explain why it could not be
satisfied and what the AI tried.

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
