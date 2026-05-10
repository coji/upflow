# RDD (Requirements Definition Documents)

実装着手前に設計判断を固め、レビュー可能な形にするためのドキュメント置き場。

このファイルは RDD の構造とセクション意味の **Single Source of Truth** である。AI 駆動の `takt -w rdd-draft` ワークフローも、人間が手で書く RDD も、ここを単一情報源として参照する。

## 目的

- 実装前に設計判断と影響範囲を明文化し、レビュー可能にする
- 実装後も判断根拠を辿れるようにする（commit message / code には残らない "なぜ"）
- 同種の設計課題が将来発生したときの参照点にする

## ファイル命名

`issue-<番号>-<短いケバブケース>.md`

例: `issue-283-multiple-github-accounts.md`

issue 番号を先頭に置くことで、`ls` / Glob でソートしやすい。slug は 3-5 語、英語推奨 (issue タイトルが日本語でも英語の slug にする)。

## 推奨構成

各 RDD は以下のセクションを含める。**順序・名前・意味は固定**。AI も人間もここを厳密に守る。

### 1. 背景・課題

なぜこの設計判断が必要になったか。issue 本文の要約 + 補足。

### 2. 現状実装の確認

**file:line で grounded に**書く。AST で確認できる事実だけ書き、推測は書かない。citation が無い factual claim は禁則。

### 3. 設計判断

- **結論** (1 文)
- **理由**
- **採らなかった代案** (最低 2 案、それぞれ採らない理由付き)

1 案だけ提示して「他は検討していない」は不可。

### 4. 要件

- **機能要件**: ユーザーから見える挙動の変化
- **非機能要件**: 性能・可用性・セキュリティ

### 5. スキーマ変更 (該当時のみ)

対象ファイル / 変更内容 / 移行安全性 (既存データの扱い、destructive 操作の有無、`IF EXISTS` の要否)。

### 6. アプリケーション変更 / UI 変更

影響モジュール (file:line)、影響画面と挙動。

### 7. 移行方針

既存データ・既存 API クライアントへの影響と移行手順。Stacked PR に分割する場合は分割粒度のメモ。

### 8. 受け入れ条件

**実装後の検証可能な挙動についてのみ書く**。これが本セクションの厳密な定義。

書くべきもの:

- Yes / No 判定可能な形にする
- 可能ならテストにマップする (例: `<file>.test.ts の <name> シナリオが green`)

書いてはいけないもの (混入を避ける):

- **RDD 自体の構造チェック** (代案 2 案以上、grounding、DRAFT マーカー有無 等) → これは下記「Draft 品質ゲート」の対象であり、受け入れ条件ではない
- **実装手順** (「X を Y に変更する」) → 「何ができていれば完了か」だけ書く
- **code snippet** → 要件レベルに留める。具体的な実装は次フェーズ (`spec-implement-accept` または codex `/goal`) で行う
- **曖昧表現** (「適切に動作する」「既存の挙動を維持する」) → 何をもって OK とするかが Yes/No で判定できるように具体化する

### 9. リスク・補足

ロールバック性、パフォーマンス影響、未解決の論点。

### 10. Open Questions (草案段階のみ、人間レビュー後は削除可)

人間レビューで答えるべき論点。AI が draft を起こす場合は **必ず非空** にする (空 = AI が overcommit している兆候)。人間が手で書いた最終版では削除しても良い。

## Draft 品質ゲート

RDD の **草案** (DRAFT マーカー付き) は以下を満たすこと:

- 冒頭に `<!-- DRAFT: 人間レビュー前。受け入れ条件・代案・移行方針は要確認。 -->` がある
- `### 設計判断` の「採らなかった代案」が 2 案以上ある
- `### 現状実装の確認` に file:line 引用がある
- `### Open Questions` が非空である
- `### 受け入れ条件` に **実装後の検証可能な挙動以外が混入していない** (RDD 自己構造チェック / 実装手順 / code snippet / 曖昧表現を含まない)

これらは **受け入れ条件ではなく**、RDD 自体の品質基準。

`takt -w rdd-draft` ワークフローで生成した場合は `rdd-draft-report.md` の `## Draft Quality Check` セクションで AI が自己評価する。人間がレビューする際もこのゲートを判定材料に使う。

DRAFT マーカーを外すのは **人間レビュー完了の合図**。AI が外してはいけない。

## ライフサイクル

- **作成**: 実装着手前。実装可能なレベルまで判断を詰める
- **更新**: 実装中に方針変更が発生したら追従させる（生きたドキュメントとして扱う）
- **完了**: 末尾に `## Status` セクションを追加し、実装した PR 番号を列挙

```markdown
## Status

Implemented in #301, #305, #309, #312, #316
```

## 作り方

### 1. 手動で起こす

腰を据えて設計を考える系のタスクはこれが基本。Claude Code セッションでも、エディタ直書きでもよい。

### 2. takt `rdd-draft` ワークフローで叩き台を生成

```bash
npx takt -w rdd-draft "#NNN"
```

issue 本文と既存コードを読んで、`docs/rdd/issue-<N>-<slug>.md` を **DRAFT マーカー付き** で起こす。出力は必ず人間がレビューして DRAFT マーカーを外すまでは未完成扱い。AI が外してはいけない。

向いているケース: 既存パターンの踏襲が多い設計、影響範囲が比較的明確、Open Questions を機械的に洗い出したい。

向いていないケース: 設計判断そのものが論争的、複数の有力代案を比較したい、ドメイン知識が浅い領域。これらは手動で書く。

## 実装フェーズへの橋渡し

完成した RDD は実装フェーズの契約書として 2 通りに使える。受け入れ条件を「実装後の検証可能な挙動」に限って書いていることが、両ルートの前提になる。

### 1 PR ぶんに収まる: takt `spec-implement-accept`

```bash
npx takt -w spec-implement-accept "#NNN"
```

RDD の「受け入れ条件」を completion criteria として `order.md` に流して spec-draft → implement → acceptance を回す。

### 複数 PR / 大規模リファクタリング: codex `/goal`

```
/goal Implement the design described in docs/rdd/issue-NNN-foo.md.
- Stay within the scope listed in その RDD の "影響範囲".
- Do not modify the RDD itself or anything outside scope.
- Validate by running `pnpm validate` after each substantive change.
- Stop when all checkboxes in the "受け入れ条件" section pass and pnpm validate is green.
```

RDD の「受け入れ条件」を verifiable な形で書いていれば、そのまま `/goal` の stopping condition として機能する。長時間自走 + 完了判定が `/goal` の本領なので、移行系・大規模リファクタリングはこちら向き。`/goal` を有効化するには `~/.codex/config.toml` の `[features]` に `goals = true`。

## 一覧

- [issue-283: 1 org に複数の GitHub App installation を紐づける](./issue-283-multiple-github-accounts.md)
- [issue-307: PR タイトルパターンによる表示フィルター](./issue-307-pr-title-filter.md)
- [issue-314: PR ポップオーバーを resource route 化して drop-in に使う](./issue-314-pr-popover-resource-route.md)
- [issue-327: テナント内 Cycle Time ダッシュボード](./issue-327-cycle-time-dashboard.md)
- [issue-332: Cycle Time を binding constraint 起点に再フレームする](./issue-332-cycle-time-constraint-reframe.md) (DRAFT)
- [issue-336: ルールインベントリ（CLAUDE / AGENTS / RDD / facets）](./issue-336-rule-inventory.md)
- [issue-363: e2e ログイン基盤（テスト専用 route + Playwright storageState）](./issue-363-e2e-login-foundation.md)
- [issue-429: PR を種別で分類して cycle time の対象範囲と意味を再定義する](./issue-429-pr-type-classification.md) (DRAFT)
