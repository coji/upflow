# RDD Draft Procedure

Generate a Requirements Definition Document (RDD) **draft** based on the issue
body and existing code. The output goes to `docs/rdd/issue-<N>-<slug>.md` and
must be marked `DRAFT` because a human reviewer is expected to refine it
before any implementation work begins.

## Steps

1. Read the issue body. Identify:
   - The problem being addressed
   - Constraints / non-goals stated by the issue author
   - References to other issues, PRs, or RDDs

2. Investigate existing code grounded in `file:line` citations:
   - Files that the change will likely touch
   - Existing patterns and dependencies in those files
   - DB schema (`db/shared.sql` / `db/tenant.sql`) if relevant
   - Multi-tenant scoping concerns (`organizationId` filters, tenant DB)

3. Pick the slug:
   - Lowercase, kebab-case, derived from the issue title
   - 3-5 words, English preferred even if the issue title is Japanese
   - Example: issue `#283 1 org に複数の GitHub アカウントを紐づける` ->
     `multiple-github-accounts`

4. Write `docs/rdd/issue-<N>-<slug>.md` with the structure recommended in
   `docs/rdd/README.md`:

   ```markdown
   # <タイトル: 1 行で表現した設計判断の趣旨>

   <!-- DRAFT: 人間レビュー前。受け入れ条件・代案・移行方針は要確認。 -->

   ## 背景・課題

   <なぜこの設計判断が必要になったか。issue 本文の要約 + 補足。>

   ## 現状実装の確認

   <file:line で grounded に。AST で確認できる事実だけ書く。>

   ## 設計判断

   ### 結論

   <一文で。例: "shared DB の installations テーブルから UNIQUE 制約を外し、organizationId + github_account_id の複合制約に置き換える">

   ### 理由

   <なぜその選択になったか。>

   ### 採らなかった代案

   - 案 X: <なぜ採らなかったか>
   - 案 Y: <なぜ採らなかったか>

   ## 要件

   ### 機能

   - <ユーザーから見える挙動の変化>

   ### 非機能

   - <性能・可用性・セキュリティ>

   ## スキーマ変更 (該当時のみ)

   - 対象: `db/shared.sql` または `db/tenant.sql`
   - 変更: <カラム追加 / インデックス追加 / 制約変更 など>
   - 移行安全性: <既存データの扱い、destructive 操作の有無、IF EXISTS の要否>

   ## アプリケーション変更

   - <影響モジュール (file:line)>

   ## UI 変更 (該当時のみ)

   - <影響画面と挙動>

   ## 移行方針

   <既存データ・既存 API クライアントへの影響と移行手順。Stacked PR で分割
   する場合は分割粒度のメモ。>

   ## 受け入れ条件

   <verifiable な形 (Yes/No 判定可能、可能ならテストで自動化可能) で書く>

   - [ ] <例: shared DB の `installations` テーブルに `organizationId, github_account_id` の UNIQUE 制約が存在する>
   - [ ] <例: 1 organization で 2 つの GitHub installation を登録した状態で `pnpm validate` が通る>
   - [ ] <例: `tests/integration/multiple-installations.test.ts` で 1 org 2 installation の代表シナリオが green>

   ## リスク・補足

   <ロールバック性、パフォーマンス影響、未解決の論点>

   ## Open Questions (人間レビューで解消すべき論点)

   - <例: tenant DB 側にも対応カラムを足すべきか別 PR にするか>
   ```

5. **DRAFT マーカー** を冒頭 HTML コメントとして必ず入れる
   (`<!-- DRAFT: 人間レビュー前... -->`)。
   人間レビュー後にこのマーカーを外すのは人間の責務。AI が外してはいけない。

6. `rdd-draft-report.md` を report 用に書く。形式は output contract に従う。
   レポートには以下を含める:
   - 作成した RDD の path
   - 採用した slug の判断根拠
   - **未確定論点** (Open Questions セクションに書いたもの) の要点
   - 既存コード調査で参照した file:line のリスト

## Rules

- **コードを書かない**。docs/rdd/ 配下と report のみ書き換え可能
- 設計判断は「結論 + 理由 + 不採用代案」を必ず書く。一案だけ提示して
  「他は検討していません」は不可
- **受け入れ条件は verifiable な形で**書く。「適切に動作する」「既存の挙動
  を維持する」のような曖昧表現は禁則。可能なら「<file>.test.ts の <name>
  シナリオが green」のようにテストにマップする
- code snippet を RDD に埋め込まない。要件レベルに留める。具体的な実装は
  後続の `spec-implement-accept` workflow か codex `/goal` で行う
- 既存 RDD を読んで品質基準と命名規約 (`docs/rdd/README.md`) を把握する
- DRAFT は draft。完成形を装わない。Open Questions に積極的に未解決論点を
  残す方が、人間レビューに価値が出る

## Routing

- 一通り書けて report に `## RDD Draft: CREATED` を出せた -> COMPLETE
- issue 情報が不足してそもそも draft を起こせない (例: issue 本文が空)、
  あるいは既存コードと矛盾するため判断不能 -> `## RDD Draft: BLOCKED` -> ABORT
