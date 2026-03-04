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

## Classify — PR 分類のゴールデンセット管理 & 評価

`lab/classify/` に PR 分類の正解ラベル（golden set）を管理し、本番分類器を評価するツール群がある。

### サイクル

```
1. judge.ts       →  data/golden/golden.json          (LLMがPRを分類 → golden labels)
                      data/golden/archive/golden_*.json (控え)
2. evaluate.ts    →  data/evals/eval_*.json            (本番分類器 vs golden を比較)
3. compare.ts     →  stdout                            (2つの eval を並べて差分表示)
```

### judge.ts — ラベル生成（メイン）

1件ずつ `generateContent` で分類し、1件完了ごとに golden.json に追記保存する。Ctrl+C で途中停止しても完了分は残る。完了時にメタデータ付きのエンベロープ形式で保存し、アーカイブにも控えを保存する。

```bash
# 全サンプルファイル
pnpm tsx lab/classify/judge.ts

# 特定ファイルだけ / モデル指定 / 件数制限
pnpm tsx lab/classify/judge.ts --file s_sample.json
pnpm tsx lab/classify/judge.ts --model gemini-2.5-pro
pnpm tsx lab/classify/judge.ts --limit 10

# 途中から再開
pnpm tsx lab/classify/judge.ts --continue
```

### judge-batch.ts — Batch API でラベル生成（大量データ向け）

Gemini Batch Prediction API で PR を一括分類する。50% コスト削減＋レート制限回避。大量データ投入時に使う。

```bash
# 新規ジョブ投入
pnpm tsx lab/classify/judge-batch.ts

# ジョブの状態確認 / 再開 / キャンセル
pnpm tsx lab/classify/judge-batch.ts --status
pnpm tsx lab/classify/judge-batch.ts --resume
pnpm tsx lab/classify/judge-batch.ts --cancel
```

### evaluate.ts — 本番プロンプトの評価

golden.json を使って本番分類器（`batch/lib/llm-classify.ts` のプロンプト）を評価する。
eval 結果には `promptHash`（プロンプトの SHA-256 先頭8文字）が含まれ、どのプロンプトでの結果か追跡できる。

```bash
# ゴールデンセット全体で分類器を評価
pnpm tsx lab/classify/evaluate.ts

# モデル指定 / 件数制限
pnpm tsx lab/classify/evaluate.ts --model gemini-3-flash-preview
pnpm tsx lab/classify/evaluate.ts --limit 50

# 前回の eval を途中から再開（同じ promptHash の最新 eval を探す）
pnpm tsx lab/classify/evaluate.ts --continue
```

### compare.ts — Eval 差分比較

2つの eval JSON を並べて差分を表示する。API 呼び出しなし。

```bash
pnpm tsx lab/classify/compare.ts data/evals/eval_A.json data/evals/eval_B.json
```

表示内容: accuracy / avgDrift のデルタ、per-class F1 のデルタ、改善・悪化した PR のリスト

## 新しい実験の追加

1. `lab/experiments/NNN-description.ts` を作成
2. `lab/data/` からデータを読み、`lab/output/` に結果を書く
3. この README の実験一覧を更新
