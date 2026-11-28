# Throughput

Throughput は PR の流れを 3 つの表で見せる。Ongoing は今開いている PR と経過日数、Merged と Deployed は週ごとの件数とマージ・デプロイまでの時間で、前後の週に送れる。

## Sub-features

- `tp-ongoing`: 開いている PR の表と、件数・経過日数の中央値
- `tp-merged`: その週にマージされた PR の表と、件数・Time to Merge の中央値・目標達成率
- `tp-week-nav`: `Previous week` / `Next week` と週のボタンで期間を変える。URL に `from` が入る
- `tp-deployed`: その週にデプロイされた PR の表
- `tp-pr-link`: タイトルが GitHub の PR への link になっている

## How to get to it (user POV)

- sidebar の Throughput → `Ongoing` / `Merged` / `Deployed`
- breadcrumb の `Throughput`

## Driving it with upflow-verify

Preconditions:

- doctor がすべて OK
- PR Filters にフィルタが無い (あると件数が減る)

シナリオ: `upflow-verify drive <RUN_ID> .claude/skills/verify-upflow/scenarios/throughput.mjs`

- **Ongoing を開く。** sidebar の link `Ongoing`。heading `Ongoing` (level 1) と、名前が `More actions` で終わる row が 8 行 (`#101`-`#108`) 出る。link `Implement SSO login flow` の href が `https://github.com/techtalk/backend/pull/102`。
- **Merged を開く。** sidebar の link `Merged`。heading `Merged` (level 1)。週の button の名前は `MM/DD – MM/DD`。
- **週を送る。** button `Previous week` を押す。週の button の文言が変わり、URL に `from=` が入り、表の行が変わる。`Next week` で元の週に戻る。
- **Deployed を開く。** sidebar の link `Deployed`。heading `Deployed` (level 1)。
- **証拠。** `ongoing`、`merged-this-week`、`merged-previous-week`、`deployed`。

## Gotchas

- 件数の表示 (`8 Ongoing` など) は数字とラベルが別の要素なので `getByText('8 Ongoing')` では取れない。表の row を数える
- seed は launch 時刻からの相対日付なので、今週の Merged の件数は曜日によって 0 件になりうる。件数の一致ではなく、週送りで行が変わることを確かめる
- 前の週に送っても説明文は `merged this week` のまま
- Deployed は seed のデプロイ日に依存し、週によって空になる。空でも heading が出れば到達はできている
