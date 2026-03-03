# Lab — 仮説検証環境

レビューボトルネック問題に対する仮説検証のためのサンドボックス。
データ取得→仮説→検証→評価のサイクルを素早く回す。

## 構成

```
lab/
├── fetch.ts              # データ取得 (GitHub API → lab/data/)
├── lib/
│   ├── github.ts         # Octokit GraphQL ラッパー
│   ├── db.ts             # DB接続 (app/services/db.server を再export)
│   ├── classify.ts       # PRサイズ分類 (影響度ベース)
│   └── llm-classify.ts   # LLMベースPR分類 (Gemini Flash)
├── data/                 # 取得データ (.gitignore)
├── experiments/          # 実験スクリプト
│   ├── 001-queue-visualization.ts
│   ├── 002-queue-throughput-correlation.ts
│   ├── 003-automerge-simulation.ts
│   └── 004-llm-classification-comparison.ts
└── output/               # 生成された可視化 HTML/JSON (コミット対象)
```

## 使い方

```bash
# 1. データ取得
pnpm lab:fetch                           # 全データ
pnpm tsx lab/fetch.ts --only events      # レビューイベントのみ
pnpm tsx lab/fetch.ts --only sizes       # PRサイズのみ
pnpm tsx lab/fetch.ts --refresh          # キャッシュ無視で再取得

# 2. 実験実行
pnpm tsx lab/experiments/001-queue-visualization.ts
pnpm tsx lab/experiments/002-queue-throughput-correlation.ts
pnpm tsx lab/experiments/003-automerge-simulation.ts

# 3. 可視化確認
pnpm lab:serve
open http://localhost:8787/review-queue-player.html
```

## 実験一覧

| #   | 名前                         | 内容                                        |
| --- | ---------------------------- | ------------------------------------------- |
| 001 | Queue Visualization          | レビューキューの人別蓄積を可視化            |
| 002 | Queue-Throughput Correlation | キューサイズとスループットの相関分析        |
| 003 | Automerge Simulation         | XS/S PR自動マージのキュー削減効果           |
| 004 | LLM Classification Compare   | Gemini Flash vs ルールベース分類比較        |
| 005 | LLM Automerge Simulation     | LLM分類ベースの自動マージ再シミュレーション |

## Classify — ゴールデンセット管理

`lab/classify/` に PR 分類のゴールデンセット（正解ラベル）を管理するツールがある。

### judge.ts — Batch API でラベル生成

Gemini Batch Prediction API で PR を分類し、`lab/classify/data/golden.json` に正解ラベルを書き出す。
成功時は golden.json を**丸ごと上書き**する（前回の結果は残らない）。失敗時は更新しない。

```bash
# 新規ジョブ投入（全サンプルファイル）
pnpm tsx lab/classify/judge.ts

# 特定ファイルだけ
pnpm tsx lab/classify/judge.ts --file xl_all.json
```

Batch API のジョブは Google 側で非同期実行される（数分〜数十分）。ジョブ投入時に `lab/classify/data/batch-job.json` にジョブ名が保存されるので、途中でプロセスが死んでも再開できる。

```bash
# ジョブの状態を1回確認
pnpm tsx lab/classify/judge.ts --status

# ポーリング再開（完了まで30秒間隔で状態表示→結果取得→golden.json 更新）
pnpm tsx lab/classify/judge.ts --resume

# ジョブ名を直接指定して再開（batch-job.json がない場合）
pnpm tsx lab/classify/judge.ts --resume batches/xxxxx
```

### judge-sequential.ts — 逐次実行でラベル生成

Batch API がスタックする場合の代替手段。1件ずつ `generateContent` で分類し、1件完了ごとに golden.json に追記保存する。Ctrl+C で途中停止しても完了分は残る。

各エントリに `judgedAt`（ISO 8601）と `judgedModel` が記録されるので、どのモデル・いつの結果かがわかる。

```bash
# 全サンプルファイル
pnpm tsx lab/classify/judge-sequential.ts

# 特定ファイルだけ
pnpm tsx lab/classify/judge-sequential.ts --file s_sample.json

# モデル指定
pnpm tsx lab/classify/judge-sequential.ts --model gemini-2.5-pro
```

### evaluate.ts

```bash
# ゴールデンセット全体で分類器を評価
pnpm tsx lab/classify/evaluate.ts
```

## 新しい実験の追加

1. `lab/experiments/NNN-description.ts` を作成
2. `lab/data/` からデータを読み、`lab/output/` に結果を書く
3. この README の実験一覧を更新
