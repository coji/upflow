# Continuous Delivery (CD)

## 要点

DORA の定義: 「あらゆる種類の変更を、オンデマンドで迅速・安全・持続的にリリースできる能力」。CI ([continuous-integration.md](./continuous-integration.md)) より広い概念で、CI + デプロイ自動化 + テスト自動化 + 組織プロセス + 文化を含む umbrella。**継続的デプロイ (Continuous Deployment) とは別物** — CD は「デプロイ可能な状態を常に維持する」、Continuous Deployment は「変更を自動的に本番へ流す」。

## なぜ重要か

CD が成立すると:

- 業務時間中でもユーザー影響なくデプロイできる
- 本番への変更が低リスクで実行できる
- リリースを「イベント」から「日常」に変えられる
- 「金曜日はデプロイしない」のような迷信が消える

## CI / CD / Deployment Automation の違い

混同されがちな 3 つを整理する:

| 概念                       | スコープ                                         | 何を担う                             |
| -------------------------- | ------------------------------------------------ | ------------------------------------ |
| **Continuous Integration** | コード統合とテスト                               | 「main が壊れていない」を保証する    |
| **Continuous Delivery**    | 統合されたコードを「いつでもデプロイ可能」に保つ | 組織・プロセス・スキル全体           |
| **Deployment Automation**  | デプロイ操作の自動化                             | 「ボタン一発でデプロイできる」仕組み |

DORA の言葉そのまま:

> 「Deployment automation is just one element of continuous delivery. Test automation, security integration, version control など 13 の技術能力が必要」

CD は umbrella で、その下に Test Automation / Trunk-Based / CI / Deployment Automation 等が含まれる。

## DORA が CD の構成要素として挙げる 13 能力

1. テスト自動化 ([test-automation.md](./test-automation.md))
2. デプロイ自動化 ([deployment-automation.md](./deployment-automation.md))
3. Trunk-based development ([trunk-based-development.md](./trunk-based-development.md))
4. 浸透的セキュリティ (pervasive security)
5. 疎結合チーム (loosely coupled teams)
6. ツール選択の自由 (empowering teams)
7. 継続的テスト (continuous testing)
8. バージョン管理 (version control)
9. テストデータ管理 (test data management)
10. 包括的モニタリング (monitoring & observability)
11. 主動的通知 (proactive notification)
12. データベース変更管理 (database change management)
13. コード保守性 (code maintainability)

本書で扱うのは 1-3 + 部分的に 13 (`pr-flow/pr-size-discipline.md` で部分対応)。残りは本書スコープ外 ([../README.md#本書のスコープ](../README.md#本書のスコープ) 参照)。

## DORA のアンチパターン

### 「頻度を上げるだけ」の実装

最も典型的な失敗パターン。プロセス・組織の改革なしに「とりあえずデプロイ頻度を上げよう」とすると:

- 障害率 (CFR) が上昇する
- チームが疲弊する
- 「速いだけで安定しない」状態に陥る

**速度と安定性の両方** が必要。片方だけ追うと結局両方失う。これが DORA 4 指標 ([../metrics/dora.md](../metrics/dora.md)) で速度と安定性の両方を見る理由。

### 自動化偏重

「自動化すれば CD」と思い込む失敗。Deployment Automation は CD の **一部** であって全部ではない。テスト自動化、組織文化、レビュープロセス、データベース管理など、すべて噛み合う必要がある。

## AI 時代の論点

### 個人 PR 数増 → デプロイ頻度の自然増

DORA 2025 で個人 PR マージ数 +98%。これに伴いデプロイ頻度も増える。CD が成立していないと:

- 障害率が増える (1 デプロイあたりリスクは同じでも、デプロイ数が倍になれば障害も倍)
- ロールバック頻度も増える
- オンコールの負荷が増える

つまり **AI で PR 数が増える = CD の成熟度がボトルネックになる**。

### CD の前提が崩れやすくなる

AI 生成 PR は既存規約と合わない場合がある (DORA 2025 で「既存規約との不整合が増える」と報告)。これが:

- データベースマイグレーションの整合性を壊す
- テストデータ管理の前提を破る
- 監視・通知の閾値を再設定が必要にする

CD の構成要素 (上記 13 能力) を、AI 時代に合わせて見直す機会になる。

## 計測

DORA 4 指標で測る:

- **Deployment Frequency**: CD の成熟度の代表指標
- **Lead Time for Changes**: 変更が本番に届くまで
- **Change Failure Rate**: 速度と安定性の両立
- **Mean Time to Restore**: 障害復旧の速さ

加えて DORA は本ページで言及:

- 再作業時間の削減 (less rework)
- デプロイ負荷の軽減 (less deployment pain)

「デプロイ前夜に開発者が緊張する」「デプロイ後の問題対応で疲弊する」が減ったかどうかを定性的にも見る。

## upflow での扱い

- ✅ Deployment Frequency: 計測対象。`pull_requests.released_at` から集計可能
- ✅ Lead Time for Changes: cycle time 全体として計測
- ❌ Change Failure Rate: 本番障害との接続が必要、未着手 ([../metrics/dora.md](../metrics/dora.md) 参照)
- ❌ MTTR: 同上
- ❌ less rework / less deployment pain: 定性指標、計測手段なし

upflow は CD の **計測側** に位置する。upflow 自体の CD 成熟度は:

- ✅ GitHub Actions の CI で `pnpm validate` 通過必須
- ✅ Fly.io への自動デプロイ (`.github/workflows/deploy.yml`)
- ✅ コード freeze なし
- ⚠️ 業務時間外のデプロイ実績はあるが「金曜デプロイ」を意識的に避ける運用ではない
- ❌ Blue-Green / Canary なし (Fly.io rolling deploy のみ)
- ❌ feature flag インフラなし

「いつでもデプロイ可能」状態の検証手段は CI green のみ。本番影響評価は手動。

## 関連

- [test-automation.md](./test-automation.md) — CD の基礎
- [trunk-based-development.md](./trunk-based-development.md) — main を release-ready に保つ
- [continuous-integration.md](./continuous-integration.md) — main を壊さない
- [deployment-automation.md](./deployment-automation.md) — デプロイ操作の自動化
- [../metrics/dora.md](../metrics/dora.md) — DORA 4 指標で CD 成熟度を測る

## 参考資料

- [DORA: Continuous Delivery](https://dora.dev/capabilities/continuous-delivery/) — 一次ソース
- [Continuous Delivery (Jez Humble & David Farley)](https://continuousdelivery.com/) — 書籍。CD の原典
- [Continuous Delivery vs Continuous Deployment (Atlassian)](https://www.atlassian.com/continuous-delivery/principles/continuous-integration-vs-delivery-vs-deployment) — 3 概念の違いの解説
