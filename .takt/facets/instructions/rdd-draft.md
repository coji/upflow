# RDD Draft Procedure

Generate a Requirements Definition Document (RDD) **draft** based on the issue body and existing code. The output goes to `docs/rdd/issue-<N>-<slug>.md` and must be marked DRAFT because human review is expected to refine it before any implementation work begins.

## Steps

1. **Read `docs/rdd/README.md` first**. It is the single source of truth for RDD structure, section semantics, and the Draft 品質ゲート. Follow its `## 推奨構成` section strictly:
   - Do not invent new section names or skip required sections
   - Apply the exact definition of `### 受け入れ条件` (post-implementation verifiable behaviors only — see README for what to exclude)
   - Mind the slug rules in `## ファイル命名`

2. Read the issue body. Identify:
   - The problem being addressed
   - Constraints / non-goals stated by the issue author
   - References to other issues, PRs, or RDDs

3. Investigate existing code grounded in `file:line` citations:
   - Files that the change will likely touch
   - Existing patterns and dependencies in those files
   - DB schema (`db/shared.sql` / `db/tenant.sql`) if relevant
   - Multi-tenant scoping concerns (`organizationId` filters, tenant DB)

4. Write `docs/rdd/issue-<N>-<slug>.md` per `docs/rdd/README.md`'s 推奨構成.

5. Place the **DRAFT marker** at the top of the file:

   ```
   <!-- DRAFT: 人間レビュー前。受け入れ条件・代案・移行方針は要確認。 -->
   ```

   The marker indicates that human review is pending. **The marker must NOT be removed by the AI.** Removing it is the human reviewer's signal of completion.

6. Write `rdd-draft-report.md` per the output contract. Include the `## Draft Quality Check` self-evaluation against `docs/rdd/README.md`'s 「Draft 品質ゲート」 section.

## Discipline (facet-specific rules that supplement README)

- **No code in RDD body.** RDD is requirements-level. Save implementation specifics for the next phase (`spec-implement-accept` or codex `/goal`).
- **Every factual claim about the codebase must cite file:line.** If you can't cite, don't claim it.
- **Open Questions are required and must be non-empty.** An RDD with no Open Questions usually means the AI overcommitted — humans should be deciding the hard choices.
- **`### 受け入れ条件` is for post-implementation verifiable behaviors only.** RDD self-structure checks (代案 2 案以上, DRAFT marker, grounding, etc.) belong in the Draft Quality Check, not 受け入れ条件. See README's `### 受け入れ条件` for the precise rule and the禁則 list.

## Routing

- Draft written + report has `## RDD Draft: CREATED` → COMPLETE
- Cannot draft (issue body too vague, code contradicts premise, missing required context) → `## RDD Draft: BLOCKED` → ABORT
