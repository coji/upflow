# SPACE / DevEx / DX Core 4

## 要点

DORA より粒度が細かく、人間と組織の側面を捉える指標フレームワーク。AI 時代に「DORA だけでは見えない」部分を補完するために重要性が増している。

## SPACE フレームワーク (2021)

DORA の著者陣 (Forsgren ら) が「DORA は組織レベルだが、開発者個人やチームの側面を取りこぼす」として提案した。5 次元の頭文字:

| 次元                              | 内容                          |
| --------------------------------- | ----------------------------- |
| **S**atisfaction & well-being     | 開発者の満足度・燃え尽き予兆  |
| **P**erformance                   | 成果物の品質・顧客影響        |
| **A**ctivity                      | コミット数・PR 数などの活動量 |
| **C**ommunication & collaboration | レビュー応答・知識共有        |
| **E**fficiency & flow             | 中断の少なさ・フロー状態      |

**重要な原則**: 1 次元だけ見ない。1 つだけ最適化すると別の次元が壊れる (例: Activity だけ見ると「コミット数稼ぎ」が起きる)。

## DevEx (2023)

SPACE と同じ著者陣が、より計測しやすい形に絞り込んだ。3 次元:

| 次元                     | 内容                        | 例                                 |
| ------------------------ | --------------------------- | ---------------------------------- |
| **フィードバックループ** | 行動 → 結果が返ってくる速さ | CI 実行時間、レビュー応答時間      |
| **認知負荷**             | コードや環境を理解する負担  | ドキュメント品質、依存関係の複雑さ |
| **フロー状態**           | 中断なく集中できる時間      | 会議数、割り込み回数               |

**AI 時代に重要なのは「認知負荷」**。AI は速くコードを生成するが、人間がそれを理解・レビューする負担は減らない。むしろ大きい PR が増えてレビュアーの認知負荷は増えている (DORA 2025)。

## DX Core 4 (2024)

[DX](https://getdx.com/) 社が DORA・SPACE・DevEx を統合した実用フレーム。4 次元:

| 次元                | 含む指標                                           |
| ------------------- | -------------------------------------------------- |
| **Speed**           | DORA の Deployment Frequency / Lead Time、PR 数    |
| **Effectiveness**   | DevEx の 3 次元 (フィードバック・認知負荷・フロー) |
| **Quality**         | CFR、本番障害率、欠陥密度                          |
| **Business Impact** | 機能リリース後の事業 KPI 影響                      |

「速度」「効率」「品質」「事業効果」を分けることで、片側だけ最適化していないかが見える。

## なぜ重要か

- **DORA の盲点を埋める**: DORA は組織レベルの結果指標。プロセスや人間の側面が見えない
- **AI 時代の前提に合う**: AI で個人の活動量 (Activity) は上がるが、満足度・認知負荷・フローは別問題
- **改善の手がかりになる**: DORA の数字が悪いとき、SPACE / DevEx を見ると「どこが原因か」が絞れる

## アンケート vs 実測

SPACE / DevEx は**実測可能な指標**と**アンケートでしか取れない指標**が混在する。

| 種類           | 例                                   | 取得方法       |
| -------------- | ------------------------------------ | -------------- |
| 実測可能       | レビュー応答時間、CI 時間、PR サイズ | git / CI ログ  |
| アンケート必須 | 満足度、燃え尽き感、フロー状態の頻度 | 四半期サーベイ |

**アンケートを軽視しない**。実測だけだと「数字は良いが疲弊している」が見えない。Stack Overflow の Developer Survey や DX 社の Engineering Benchmark などが参考になる。

## upflow での扱い

upflow は git ベースの実測指標に集中しているため、SPACE / DevEx の一部 (Communication & collaboration の応答時間、Efficiency & flow の一部) しか触れていない。

- ✅ レビュー応答時間 (Pickup Time として実装)
- ✅ PR 活動量 (Activity の一部)
- ❌ 満足度・認知負荷・フロー状態 (アンケート機能なし、将来課題)
- ❌ CI 実行時間 (フィードバックループの主指標、未対応)

CI 時間と認知負荷の指標化は ROI が高いと考えられるが、未着手。

## 参考資料

- [The SPACE of Developer Productivity (ACM Queue, 2021)](https://queue.acm.org/detail.cfm?id=3454124) — SPACE 原典 (Forsgren, Storey, Maddila, Zimmermann, Houck, Butler)
- [DevEx: What Actually Drives Productivity (ACM Queue, 2023)](https://queue.acm.org/detail.cfm?id=3595878) — DevEx 原典 (Noda, Storey, Forsgren, Greiler)
- [Measuring developer productivity with the DX Core 4](https://getdx.com/research/measuring-developer-productivity-with-the-dx-core-4/) — DX Core 4
- [DORA vs SPACE vs DevEx 2026: Engineering Productivity Frameworks Compared](https://pandev-metrics.com/docs/blog/dora-vs-space-vs-devex-2026)

> **原典確認の状況 (2026-05 検証時点)**: ACM Queue の 2 本 (SPACE, DevEx) は本書執筆時に外部 fetch がブロックされ、原文 PDF を直接確認できなかった。本書の記述は WebSearch で得た複数の二次ソース (上記 DX / pandev-metrics 記事等) と専門書のオンライン要約に基づく。各 framework の 5 次元 / 3 次元の分類自体は広く一致しており大きな食い違いは確認していないが、引用時は二次ソース由来を明示する。原典は ACM Digital Library から購読アクセスで入手可能。
