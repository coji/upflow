# DORA 4 指標

## 要点

DORA (DevOps Research and Assessment) が定義した、ソフトウェアデリバリーのパフォーマンスを測る 4 つの指標。Google が 2014 年から続けている調査で、業界標準のベースラインになっている。

## 4 指標

| 指標                            | 定義                             | 何を見るか                           |
| ------------------------------- | -------------------------------- | ------------------------------------ |
| **Deployment Frequency**        | 本番への配信頻度                 | 速度: 価値を頻繁に届けられているか   |
| **Lead Time for Changes**       | コミット → 本番の所要時間        | 速度: 一つの変更がどれだけ速く届くか |
| **Change Failure Rate**         | デプロイ起因で本番障害が出た割合 | 安定性: 速くしても壊れていないか     |
| **Mean Time to Restore (MTTR)** | 障害発生 → 復旧までの平均時間    | 安定性: 壊れたときの回復力           |

最初の 2 つが速度、残り 2 つが安定性。両方を一緒に見ることで「速いだけ」「安定だけ」のチームを区別する。

## 業界ベンチマーク (DORA 2024)

| パフォーマンス層 | Deployment Frequency    | Lead Time        | CFR   | MTTR             |
| ---------------- | ----------------------- | ---------------- | ----- | ---------------- |
| Elite            | 1 日複数回              | < 1 時間         | 0-15% | < 1 時間         |
| High             | 1 日 〜 1 週間に 1 回   | 1 日 〜 1 週間   | 0-15% | < 1 日           |
| Medium           | 1 週間 〜 1 ヶ月に 1 回 | 1 週間 〜 1 ヶ月 | 0-30% | < 1 日           |
| Low              | 1 ヶ月 〜 6 ヶ月に 1 回 | 1 ヶ月 〜 6 ヶ月 | 30%+  | 1 週間 〜 1 ヶ月 |

数値の境界は年ごとに変わるので、特定の年の数字を引用するときは年も明記する。

## なぜ重要か

- **業界標準**: 同業他社や業界平均と比較するときの共通言語になる
- **速度と安定性の両立を強制**: 4 指標の片側だけ最適化すると数字に出る (例: デプロイ頻度を上げただけで CFR が悪化したらすぐ見える)
- **継続的改善のループ**: 数字 → 原因分析 → 改善 → 数字、のサイクルを回せる

## AI 時代の歪み

DORA 2025 によると、AI 支援の普及で **指標自体が歪む** ケースが報告されている:

- **Lead Time が短く見える**: コーディング時間が AI で短縮されるが、その分 PR サイズと PR レビュー時間が増える。PR レビュー時間が含まれない計測だと「速くなった」と誤読する
- **Deployment Frequency が上がる**: 個人 PR 数が +98% 増えるので、それに伴ってデプロイ頻度も上がるが、組織全体のスループット (epics 完了数等) は横ばい
- **Change Failure Rate**: AI 生成コードが既存規約と合わずに後から問題化するケースが報告されている

つまり「DORA 4 指標が改善した」だけでは AI 時代の生産性向上を主張できない。SPACE / DevEx の補完が要る ([space-devex.md](./space-devex.md))。

## upflow での扱い

upflow は **Lead Time for Changes** を構成する **PR cycle time** (Coding / Pickup / Review / Deploy) を計測する。

- ✅ Coding Time / Pickup Time / Review Time / Deploy Time の分解 (`batch/bizlogic/cycletime.ts`)
- ✅ 期間別・チーム別・リポジトリ別のフィルタ
- ❌ Deployment Frequency 単独の指標化 (将来課題)
- ❌ Change Failure Rate (本番障害との接続が必要、未着手)
- ❌ MTTR (同上)

PR cycle time の中央値中心の表示が AI 時代に機能不全を起こしている件は、issue #332 と [pr-flow/pr-size-discipline.md](../pr-flow/pr-size-discipline.md) を参照。

## 参考資料

- [DORA | dora.dev](https://dora.dev/) — 一次ソース。年ごとのレポートあり
- [DORA Research: 2025 Overview](https://dora.dev/research/2025/) — 2025年版
- [State of AI-assisted Software Development 2025](https://dora.dev/dora-report-2025/) — AI に焦点
- [Accelerate](https://nicolefv.com/book) — 書籍。指標の理論的背景
