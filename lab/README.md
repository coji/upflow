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

## 新しい実験の追加

1. `lab/experiments/NNN-description.ts` を作成
2. `lab/data/` からデータを読み、`lab/output/` に結果を書く
3. この README の実験一覧を更新
