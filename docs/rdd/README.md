# RDD (Requirements Definition Documents)

実装着手前に設計判断を固め、レビュー可能な形にするためのドキュメント置き場。

## 目的

- 実装前に設計判断と影響範囲を明文化し、レビュー可能にする
- 実装後も判断根拠を辿れるようにする（commit message / code には残らない "なぜ"）
- 同種の設計課題が将来発生したときの参照点にする

## ファイル命名

`issue-<番号>-<短いケバブケース>.md`

例: `issue-283-multiple-github-accounts.md`

issue 番号を先頭に置くことで、`ls` / Glob でソートしやすい。

## 推奨構成

各 RDD に最低限以下を含める。

- 背景・課題
- 現状実装の確認（file:line で grounded に）
- 設計判断（結論 + 理由 + 採らなかった代案）
- 要件（機能 / 非機能）
- スキーマ変更
- アプリケーション変更
- UI 変更
- 移行方針
- 受け入れ条件（テスト可能な形で）
- リスク・補足

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

issue 本文と既存コードを読んで、`docs/rdd/issue-<N>-<slug>.md` を **DRAFT マーカー付き** で起こす。出力は必ず人間がレビューして `DRAFT` マーカーを外すまでは未完成扱い。AI が外してはいけない。

向いているケース: 既存パターンの踏襲が多い設計、影響範囲が比較的明確、Open Questions を機械的に洗い出したい。

向いていないケース: 設計判断そのものが論争的、複数の有力代案を比較したい、ドメイン知識が浅い領域。これらは手動で書く。

## 実装フェーズへの橋渡し

完成した RDD は実装フェーズの契約書として 2 通りに使える。

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
- [issue-336: ルールインベントリ（CLAUDE / AGENTS / RDD / facets）](./issue-336-rule-inventory.md)
- [issue-363: e2e ログイン基盤（テスト専用 route + Playwright storageState）](./issue-363-e2e-login-foundation.md)
