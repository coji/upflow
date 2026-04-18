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

## 一覧

- [issue-283: 1 org に複数の GitHub App installation を紐づける](./issue-283-multiple-github-accounts.md)
- [issue-307: PR タイトルパターンによる表示フィルター](./issue-307-pr-title-filter.md)
- [issue-314: PR ポップオーバーを resource route 化して drop-in に使う](./issue-314-pr-popover-resource-route.md) ([作業計画](./issue-314-work-plan.md))
