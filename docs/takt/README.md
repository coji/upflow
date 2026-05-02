# TAKT 運用ガイド

upflow では [takt](https://github.com/nrslib/takt) を使って issue → 仕様生成 → 実装 → 受け入れ → PR の流れをマルチエージェントでオーケストレーションする。

## 起動パターン

### 1. Issue 駆動（推奨）

GitHub issue 番号を渡して起動する。issue 本文がそのままタスク仕様の入力になる。

```bash
npx takt "#336"          # ショートハンド
npx takt -i 336          # 同等
```

issue 駆動だと **PR タイトルが `[#336] <issue title>` の形になる**。後から RDD / 実装 / 受け入れまで一貫して issue に紐づくので追跡しやすい。

### 2. アドホック（issue がないタスク）

```bash
npx takt add "Add something..."
npx takt run
```

issue ref なしの場合、PR タイトルは task 文字列の先頭 100 文字になる（slug ではない）。長くしすぎると切られるので、最初の 1 行を要点にまとめる。

## ワークフロー

`.takt/workflows/` に置く。現状 2 本:

| workflow | 用途 |
|----------|------|
| `spec-implement-accept` | 仕様起草 → レビュー → 実装 → 受け入れ → simplify → 最終判定 のフル工程（**通常はこれを使う**） |
| `implement-step` | 計画済の 1 step だけ実装 + parallel review + fix を回す軽量版 |

`takt add` 時に対話プロンプトが出るので、カテゴリ → workflow を選ぶ。tasks.yaml に書き込まれた `workflow:` フィールドを後から手で書き換えてもよい。

## ラベル運用

`takt-ready` / `takt-blocked` / `priority:*` の規約は [labels.md](./labels.md) を参照。`takt-poll` cron（将来導入予定）はこのラベルで対象 issue を絞る。

## persona / provider 振り分け

`.takt/config.yaml` の `persona_providers` で persona ごとにプロバイダを指定している。設計意図:

- **要件レベルの起草・レビュー・受け入れ**: Codex / gpt-5.5（コード混入を防ぎたい）
- **要件レベルの修正・simplify・最終判定**: Claude Code / Opus 4.7（Max 20x の余力を活用）
- **コード編集**: Cursor / composer-2-fast

[`.takt/config.yaml`](../../.takt/config.yaml) のコメントも参照。

## PR と branch

- branch 名: `takt/<timestamp>-<slug>`（issue ref があれば slug は issue 由来）
- 通常 takt run は `.takt/tasks.yaml` の `auto_pr: true` で push 直後に PR を draft で立てる
- PR 本文末尾には実行レポート（`Workflow X completed successfully` 等）が入る

## トラブルシューティング

### 実行中タスクの状態確認

```bash
npx takt list
```

interactive UI で task ごとの status / branch / report を見られる。`failed` / `running` のものは retry / delete が選べる。

### 中断・再開

`takt run` を Ctrl+C で止めても、`status: running` のまま残ったタスクは次回実行で `pending` に戻されて再開される。run log は `.takt/runs/<slug>/logs/` の NDJSON。

### worktree

`worktree: true` のタスクは `git clone --shared` で隣にクローンを作って実行する。ローカルのワーキングツリーは汚れない。デフォルト先は `../takt-worktrees/`。

## CI 統合（pipeline mode）

非対話・自動実行向けに `--pipeline` モードがある。GitHub Actions cron でこのモードを使い、`@claude` mention や `takt-ready` ラベルを起点に走らせる構想は issue #336 の C パターン参照。pipeline 用の PR テンプレは `.takt/config.yaml` の `pipeline:` セクションで設定済み。

## 関連リンク

- [labels.md](./labels.md) — issue label 規約
- [`.takt/config.yaml`](../../.takt/config.yaml) — provider / persona 振り分け
- [`.takt/workflows/`](../../.takt/workflows) — workflow 定義
- [issue #336](https://github.com/coji/upflow/issues/336) — harness / takt 整備の上位 issue
