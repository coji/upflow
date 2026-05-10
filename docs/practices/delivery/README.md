# delivery/ — コードを main から本番に届ける

PR がレビューを終えてから、ユーザーに変更が届くまでの実践群。

## なぜこの章があるか

`pr-flow/` と `code-review/` は **PR が main にたどり着くまで** を扱う。本章は **main にたどり着いた変更を本番に届ける** までを扱う。upflow の cycle time でいうと **Deploy Time** の区間に対応する。

## 階層構造

DORA の能力モデルを読むと、これらの能力には前提関係がある:

```
土台: Test Automation
        ↓ 前提
       Trunk-based Development
        ↓ 前提
       Continuous Integration
        ↓ 前提
       Continuous Delivery (umbrella)
        ↓ 含む
       Deployment Automation
```

下から積む構造。テスト自動化なしに trunk-based は成立せず、CI なしに CD は成立せず、CD なしに Deployment Automation は意味を持たない。

## ファイル一覧

- [test-automation.md](./test-automation.md) — テスト自動化 (土台、AI 生成テスト論を含む)
- [trunk-based-development.md](./trunk-based-development.md) — 短命ブランチで main を常に release-ready に保つ
- [continuous-integration.md](./continuous-integration.md) — 全変更を毎回統合してテスト
- [continuous-delivery.md](./continuous-delivery.md) — いつでもデプロイ可能な状態を維持 (上記 3 つを統合する概念)
- [deployment-automation.md](./deployment-automation.md) — ボタン一発でデプロイできる仕組み

## 既存章との関係

- `pr-flow/merge-queue.md` は CI の安定性を前提にしている → [continuous-integration.md](./continuous-integration.md) で詳細化
- `pr-flow/stacked-prs.md` は trunk-based の文脈で語られる → [trunk-based-development.md](./trunk-based-development.md) で関係明示
- `code-review/ai-human-split.md` の AI 生成コードのテスト → [test-automation.md](./test-automation.md) で AI 生成テストとして展開

## DORA 原理 + AI 時代の翻訳

DORA の各能力定義は 2018-2024 のデータが中心で、AI コーディング支援が普及する前の前提が混じる。本章では:

1. DORA の主張を **そのまま提示** (誤魔化さない)
2. その背後の **原理** を分解する
3. AI 時代の **実装** で原理を再構成する

例: trunk-based の「同期人間レビュー」推奨は、原理「即時 feedback でブランチを長引かせない」に分解できる。AI レビューが即時 feedback を担う 2026 年では、人間まで同期する必要は薄れる。詳細は [trunk-based-development.md](./trunk-based-development.md) 参照。

## upflow での扱い (この章全体)

- ✅ Deploy Time を計測 (`pull_requests.deploy_time`)
- ✅ Vitest (unit) + Playwright (E2E) のテスト二段構成
- ✅ GitHub Actions の CI (`.github/workflows/`)
- ✅ Fly.io への自動デプロイ (`.github/workflows/deploy.yml`)
- ❌ Deployment Frequency 単独の指標化
- ❌ CI 実行時間の計測
- ❌ flaky テストの監視
- ❌ Blue-Green / Canary デプロイ

各ファイルでより詳しい現状を記述する。
