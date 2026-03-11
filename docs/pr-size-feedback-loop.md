# PR Size Feedback Loop

LLM による PR サイズ分類を、チーム・リポジトリの暗黙知で補正し、
分類精度の向上とアクション自動化を段階的に実現する計画。

## 背景

- LLM classifier は diff の構造から認知負荷を推定するが、人間が感じる実際の負荷はコンテキスト依存
- 「認証周りは 1 行でも怖い」「このリポはテスト網羅されてるから安心」といった暗黙知が反映されない
- このギャップ自体がチーム固有のナレッジであり、蓄積する価値がある

## ゴール

1. フィードバックが自然に蓄積される仕組みを作る
2. 蓄積されたフィードバックで classify の精度を向上させる
3. サイズ × リスクに基づくアクション推奨（自動マージ、分割提案、エース投入）を実現する

## Phase 1: フィードバック UI

**目的**: LLM 分類と人間の判断の差分を収集するループを作る。

### データモデル

テナント DB に `pullRequestFeedbacks` テーブルを追加:

```sql
CREATE TABLE pullRequestFeedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pullRequestId INTEGER NOT NULL REFERENCES pullRequests(id),
  feedbackBy TEXT NOT NULL,            -- GitHub ログイン
  originalComplexity TEXT,             -- LLM が出した値
  correctedComplexity TEXT NOT NULL,   -- 人間が修正した値
  reason TEXT,                         -- 任意テキスト
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pullRequestId, feedbackBy)
);
```

設計判断:

- `pullRequests.complexity` は上書きしない。「LLM は XS と言ったが人間は M にした」という差分が価値
- `UNIQUE(pullRequestId, feedbackBy)` で 1 PR につき 1 人 1 フィードバック（上書き更新）
- 修正履歴を残すことで、後の分析やルール抽出に使える

### UI

Dashboard / Ongoing テーブルの SizeBadge をクリック → Popover:

- 現在のサイズ表示（LLM 判定）
- 5 つのサイズボタン（XS / S / M / L / XL）から選択
- 理由テキストフィールド + 「AI ドラフト」ボタン
- 保存ボタン

修正済みのバッジは視覚的に区別する（例: 枠線やアイコン）。

### AI ドラフト機能（reason 自動生成）

理由の手入力はハードルが高く書かない人が多い。
「AI ドラフト」ボタンを押すと、LLM が PR の情報から理由を推測してテキストフィールドに下書きを入れる。
ユーザーは確認・編集して保存するだけ。

LLM に渡すコンテキスト:

- PR タイトル、ブランチ名、変更ファイル一覧
- LLM の元の分類結果と理由（`complexity`, `complexityReason`, `riskAreas`）
- ユーザーが選択した修正後のサイズ
- レビューコメント（`pull_request_reviews` から取得）
- PR コメント / レビューコメントの内容（`githubRawData` から取得）
- コミットメッセージ一覧

プロンプト例:

```
LLM はこの PR を {original} と分類しましたが、レビュアーは {corrected} が適切だと判断しました。
以下の PR 情報をもとに、なぜサイズ感が異なるのかを 1〜2 文で簡潔に説明してください。
このチームが今後同様の PR を分類する際のルールとして活用します。
```

この推測自体が暗黙知の言語化になり、Phase 2 のルール抽出の質を大きく上げる。

### 実装場所

- テーブル: `db/tenant.sql`
- mutation: `app/routes/$orgSlug/_index/mutations.server.ts` 等
- UI: `app/routes/$orgSlug/+components/size-badge.tsx` を拡張

## Phase 2: フィードバック集約とルール抽出

**目的**: 蓄積されたフィードバックからリポジトリ/チーム単位のルールを自動生成する。

- リポジトリ単位でフィードバックを集約
- LLM で傾向を要約してルール化（例: 「このリポでは `src/auth/` 配下の変更は M 以上」）
- ルールはテナント DB に保存

## Phase 3: コンテキスト注入

**目的**: 抽出されたルールを classify プロンプトに注入し、精度を向上させる。

- `batch/lib/llm-classify.ts` のプロンプトにリポ固有ルールを追加
- フィードバック付き PR を few-shot example として使う
- 精度の変化をトラッキングする仕組み（フィードバック率の推移で計測）

## Phase 4: アクション推奨

**目的**: サイズとリスクに基づいて具体的なアクションを提案する。

### アクションマトリクス

```
              低リスク              高リスク
XS/S    → AI レビュー+自動マージ  → 人間レビュー（軽め）
M       → 通常レビュー            → シニアレビュー
L/XL    → 分割提案               → エース投入+同期レビュー
```

### 機能

- Dashboard に推奨アクションを表示
- XS/低リスク PR の自動マージ候補リスト
- L/XL PR への分割提案（LLM で分割案を生成）
- 高リスク PR へのエースアサイン提案

## 依存

- Phase 1 は現状の仕組みだけで着手可能
- Phase 2-3 はフィードバックが十分に蓄積されてから
- Phase 4 は GitHub API 連携（自動マージ、レビュアーアサイン）が必要

## 次のアクション

Phase 1 から着手:

1. `pullRequestFeedbacks` テーブルの作成
2. フィードバック保存の mutation 実装
3. SizeBadge を Popover 付きに拡張
4. 修正済みバッジの視覚的区別
