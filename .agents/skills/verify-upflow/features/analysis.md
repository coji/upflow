# Analysis

Analysis は 3 か月などの期間で PR の流れを分析するグラフ群。Cycle Time は最初のコミットからマージまでの時間を段階 (Coding、Pickup、Review) に分けて週ごとに見せ、Review Bottleneck はレビュー待ちの山と PR サイズ・WIP との関係、Inventory は滞留している PR の量、Feedbacks は PR 分類へのフィードバックを見せる。

## Sub-features

- `an-cycle-time`: 週ごとの積み上げグラフ、段階の割合、Insights、作者ごとの表
- `an-cycle-metric`: `Median` / `Average` の切り替え
- `an-cycle-filters`: repository と期間の combobox
- `an-reviews`: Review Queue Trend、WIP Count vs Review Time、PR Size Distribution & Review Time
- `an-inventory`: 滞留している PR の量の推移
- `an-feedbacks`: PR 分類へのフィードバックの一覧

## How to get to it (user POV)

- sidebar の Analysis → `Cycle Time` / `Review Bottleneck` / `Inventory` / `Feedbacks`

## Driving it with upflow-verify

Preconditions:

- doctor がすべて OK
- PR Filters にフィルタが無い

シナリオ: `upflow-verify drive <RUN_ID> .claude/skills/verify-upflow/scenarios/analysis.mjs`

- **Cycle Time。** sidebar の link `Cycle Time`。heading `Cycle Time` (level 1)、`Weekly Cycle Time Trend`、img `Cycle time stage composition`、作者の表に row `alice Alice Chen ...` が出る。
- **集計を切り替える。** radio `Average` を押す。`Average` が checked になる。
- **Review Bottleneck。** sidebar の link `Review Bottleneck`。heading `Review Bottleneck` (level 1)、`Review Queue Trend`、`PR Size Distribution & Review Time` が出る。
- **Inventory。** sidebar の link `Inventory`。URL が `/analysis/inventory`、heading `Open PR Inventory` (level 1)。
- **Feedbacks。** sidebar の link `Feedbacks`。URL が `/analysis/feedbacks`、heading `Feedbacks` (level 1)。
- **証拠。** `cycle-time-3-months`、`cycle-time-average`、`review-bottleneck`、`inventory`、`feedbacks`。

## Gotchas

- グラフ (role `application`) の中の数値は ARIA snapshot にテキストで出るが、描画の細部は screenshot で見る
- グラフの軸の日付はブラウザの locale (`ja-JP`) で出る (`8月 31` など)
- sidebar の link を押した直後は前の画面の heading が残っている。level 1 の heading だけで待つと前の画面で通ってしまうので、URL と heading の名前の両方で待つ
- Feedbacks は heading までしか確かめていない
- 期間・repository の combobox はまだシナリオで操作していない
