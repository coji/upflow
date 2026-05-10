# AI 生産性のパラドックス

## 要点

AI コーディング支援の普及で、**個人の出力は劇的に増えた**が、**組織のデリバリー指標は横ばいか悪化**している現象。DORA 2025 の調査で業界規模で確認された。原因はボトルネックがコーディングからレビュー・統合に移ったため。

## DORA 2025 の数字

| 指標                     |       変化 |
| ------------------------ | ---------: |
| 個人タスク完了           |       +21% |
| 個人 PR マージ数         |       +98% |
| Epic 完了数 / 開発者     |     +66.2% |
| **PR レビュー中央値**    |  **+441%** |
| **レビューなしマージ率** |   **+31%** |
| **PR サイズ (行数)**     | **+51.3%** |

「個人が速くなる → 組織が速くなる」が成立していない。むしろ後者は悪化している。

> **数値の出典について (2026-05 検証時点)**: 上記数値は DORA 公式ページ ([dora-report-2025](https://dora.dev/dora-report-2025/)) の概要には掲載されておらず、本書では **二次ソース** ([Faros](https://www.faros.ai/blog/key-takeaways-from-the-dora-report-2025), [InfoQ](https://www.infoq.com/news/2026/03/ai-dora-report/), [Honeycomb](https://www.honeycomb.io/resources/reports/dora-report-2025) 等) で複数確認できた数値を採用している。原典 PDF を直接確認した訳ではないので、引用するときは「二次ソース由来」を明示する。完全な原典確認は dora.dev からダウンロードできる PDF を参照。

## なぜ起きるか

### 構造

```
[Before AI]                    [After AI]
コーディング: 遅い              コーディング: 速い (AI 補助)
   ↓ ボトルネックはここ           ↓
レビュー: 普通                  レビュー: 詰まる ← 新ボトルネック
   ↓                            ↓
統合・配信: 普通                統合・配信: 詰まる
```

AI でコーディングが速くなった分、PR が多く・大きく流れ込む → レビューと統合が詰まる → 組織レベルの完了速度は変わらない。

### 具体的なメカニズム

1. **PR が膨れる**: AI は一気に書けるので「ついでに直す」が増えて 1 PR あたりの行数が増える (+51.3%)
2. **レビュアーの認知負荷**: 大きい PR を読む負荷は人間側で増えるだけ。AI レビューも完全代替ではない
3. **「とりあえずマージ」の誘惑**: AI が書いたコードを人間が深く読まずに通す → レビューなしマージ +31%
4. **既存規約との不整合**: AI は既存コードベースの暗黙のスタイルや設計判断を踏まえずに生成しがち。後から手戻りが発生
5. **CI の負荷**: PR 数 +98% で CI 実行回数も増える。CI が遅いとレビュー → CI 待ち → re-review のサイクルが詰まる

## 兆候の検出

自分のチームでパラドックスが起きているかを判定する指標:

| 兆候                       | 計測方法                                  | 危険水準の目安                           |
| -------------------------- | ----------------------------------------- | ---------------------------------------- |
| PR サイズ増加              | 行数の中央値・平均の月次推移              | 6 ヶ月で +20% 超                         |
| レビューなしマージ率       | reviews=0 の PR / 全 PR                   | 業界平均 31% を超えたら警戒              |
| 上位の遅い PR の比率       | 上位 10% の PR が cycle time に占める割合 | 70% 超なら強く偏在                       |
| Pickup Time の長尾         | p90 と中央値の比                          | 30 倍以上で異常 (中央値が機能していない) |
| 個人 PR 数と Epic 数の乖離 | 個人 PR 数の伸び ÷ Epic 完了数の伸び      | 2 倍以上の乖離                           |

これらが揃っていれば、AI で「個人は速くなったが組織は速くなっていない」状態。

## 対策との対応

各兆候に対応する実践:

| 兆候                 | 対策                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| PR サイズ増加        | [pr-size-discipline.md](../pr-flow/pr-size-discipline.md), [stacked-prs.md](../pr-flow/stacked-prs.md)       |
| レビューなしマージ率 | [ai-human-split.md](../code-review/ai-human-split.md), [first-review-sla.md](../pr-flow/first-review-sla.md) |
| 上位の遅い PR の偏在 | [pr-size-discipline.md](../pr-flow/pr-size-discipline.md)                                                    |
| Pickup Time の長尾   | [first-review-sla.md](../pr-flow/first-review-sla.md), [merge-queue.md](../pr-flow/merge-queue.md)           |
| 認知負荷の増大       | [review-quality.md](../code-review/review-quality.md), [ai-human-split.md](../code-review/ai-human-split.md) |

## upflow での扱い

upflow はこのパラドックスの **検出側** に位置する。

- ✅ PR サイズの月次推移 (PR Size 分類で代替可能)
- ✅ Pickup Time / Review Time の中央値・p90
- ⚠️ レビューなしマージ率 (raw データはあるが UI で出していない)
- ❌ 上位 10% の PR が cycle time に占める割合 (issue #332 の論点)
- ❌ Epic 完了数との乖離 (issue 単位の集計が要る、未着手)

issue #332 はこのパラドックスを検出可能にする画面再設計の試み。本ファイルの内容を踏まえて RDD を更新する余地がある。

## 参考資料

- [DORA | State of AI-assisted Software Development 2025](https://dora.dev/dora-report-2025/) — 一次ソース
- [AI Is Amplifying Software Engineering Performance, Says the 2025 DORA Report (InfoQ)](https://www.infoq.com/news/2026/03/ai-dora-report/) — 解説
- [DORA Report 2025 Key Takeaways: AI Impact on Dev Metrics (Faros)](https://www.faros.ai/blog/key-takeaways-from-the-dora-report-2025) — まとめ
- [Rethinking Dev Productivity in 2026: Beyond Velocity](https://www.ai-infra-link.com/why-developer-productivity-beats-velocity-as-the-key-performance-metric/)
