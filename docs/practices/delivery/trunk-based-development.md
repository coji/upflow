# Trunk-based development (短命ブランチで main を保つ)

## 要点

DORA の定義: 開発者が小さな単位の変更を main (trunk) に頻繁にマージする運用。**ブランチ寿命は数時間以内、同時アクティブブランチ 3 以下、毎日 main に merge** が高パフォーマンスチームの基準。長命の feature ブランチは anti-pattern。

## なぜ重要か

「ブランチ寿命が長いほど、マージ時の競合と統合コストが指数的に増える」。これが trunk-based の出発点。1 週間ブランチを温めると、その間に main は 50 commit 進み、merge 時に「他人の変更との衝突」「自分の変更を main の最新に合わせる」「再テスト」が一気にくる。

「if something takes a lot of time and energy, you should do it more often, forcing you to make it less painful」(DORA の言葉)。痛い作業ほど頻度を上げて、毎回の苦痛を最小化する。

## DORA の推奨実践

| 項目                                    | 基準                              |
| --------------------------------------- | --------------------------------- |
| ブランチ寿命                            | **数時間以内** (数日でも長すぎる) |
| 同時アクティブブランチ                  | **3 以下** (チーム単位)           |
| main への merge 頻度                    | **1 日 1 回以上**                 |
| code freeze (リリース前の停止期間)      | **なくす**                        |
| 統合フェーズ (リリース前にまとめて統合) | **なくす**                        |

「常に main が release-ready」が trunk-based の最終形。

## DORA のアンチパターン

DORA は明示的に以下を anti-pattern として挙げている:

| 失敗                                    | なぜ問題か                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| **重いコードレビュー** (複数承認必須等) | 開発者が「レビュー待ちが面倒」と変更を batch 化する → ブランチ寿命が伸びる   |
| **非同期レビュー**                      | レビュー応答までの時間 = ブランチ寿命の伸び。merge conflict 発生確率も上がる |
| マージ前テストが無い                    | 壊れたコードが trunk に入る → 全員ブロック                                   |
| 長命 feature ブランチ                   | ブランチが分岐するほど統合コストが上がる                                     |

## DORA の主張を分解する

DORA が「同期レビュー」を推奨する **背後の原理** は何か:

| DORA の主張          | 背後の原理                                 |
| -------------------- | ------------------------------------------ |
| ブランチ < 数時間    | ブランチ寿命を短く保ち、マージ競合を減らす |
| Daily merge to trunk | 大規模統合を避け、毎回の統合コストを下げる |
| Synchronous review   | 即時 feedback でブランチを長引かせない     |

3 つ目「同期レビュー」は **手段** であって、目的は「ブランチを長引かせない」こと。これは重要な分解。なぜなら:

**DORA の研究は 2018-2024 のデータが中心で、AI コーディング支援の前の前提が混じる**。

AI レビューが即時 feedback を返す 2026 年では、「人間が同期で見る」必要性は変わっている。

## AI 時代の翻訳

DORA の原理を AI 時代の実装で再構成する:

| DORA の原理          | 2026 年の実装                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ブランチ < 数時間    | ✅ そのまま採用。AI で書く速度が上がっているので物理的にも可能                                                                                                                  |
| Daily merge to trunk | ✅ そのまま採用                                                                                                                                                                 |
| 即時 feedback        | **AI レビューが PR open 後 1-2 分で 1 次 feedback** (同期相当)。人間レビューは初回 6 時間 SLA で 2 次補完 ([../pr-flow/first-review-sla.md](../pr-flow/first-review-sla.md))    |
| 同期人間レビュー     | ❌ 不採用。AI レビューが即時 feedback の役を担うので、人間まで同期する必要なし。人間は深い設計判断に集中 ([../code-review/ai-human-split.md](../code-review/ai-human-split.md)) |

つまり「DORA の精神は守る、形式は AI 時代に翻訳する」。形式的な「同期 vs 非同期」より、**ブランチ寿命と最初の feedback 時間** で測るのが本質。

## 既存運用との関係

- [../pr-flow/stacked-prs.md](../pr-flow/stacked-prs.md) — 大きな機能を小さな PR の連鎖に分割。trunk-based のブランチ寿命基準を維持しながら大きな変更を扱う方法
- [../pr-flow/pr-size-discipline.md](../pr-flow/pr-size-discipline.md) — PR を 200-400 行に保つことが、ブランチを短時間で merge できる前提
- [../pr-flow/first-review-sla.md](../pr-flow/first-review-sla.md) — 「同期 review」の役割を「AI 即時 + 人間 6h SLA」で分担する根拠

## upflow での扱い

- ✅ ブランチ寿命: 実態として数時間〜1 日 (今日も複数 PR が数時間で merge)
- ✅ Daily merge to trunk: PR が 1 日 1 回以上マージされる頻度
- ✅ 即時 feedback: CodeRabbit が PR open 後すぐ走る + Claude Code 等の AI 補助
- ✅ 6 時間 SLA: 人間レビューは [../pr-flow/first-review-sla.md](../pr-flow/first-review-sla.md) の運用
- ✅ コード freeze なし: リリース停止期間を持たない運用
- ⚠️ 同時アクティブブランチ: 計測してない (現状は感覚的に 3 以下)
- ❌ ブランチ寿命の継続計測: 仕組みなし。upflow が dashboard 機能として持てると面白い
- ❌ 「main が常に release-ready」の継続検証: 仕組みなし (CI は通っているが本番デプロイ可能性の確認は別)

## 計測

DORA の計測項目:

- 同時アクティブブランチ数
- code freeze の頻度
- daily merge の頻度
- code review 承認時間

これは upflow が dashboard で出せる範囲が大きい (raw データは揃っている)。issue として切り出す価値あり。

## 参考資料

- [DORA: Trunk-Based Development](https://dora.dev/capabilities/trunk-based-development/) — 一次ソース
- [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/) — Paul Hammant の解説サイト。ブランチパターンの図解豊富
- [Continuous Delivery (Jez Humble)](https://continuousdelivery.com/) — 書籍。trunk-based を理論的背景含めて解説
