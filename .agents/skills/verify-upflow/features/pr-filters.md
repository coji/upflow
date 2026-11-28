# PR Filters

PR Filters は、タイトルかソースブランチに指定した文字列を含む PR を、Review Stacks・Throughput・Analysis のすべてから隠す設定。大文字小文字を区別しない部分一致で、行ごとに有効・無効を切り替えたり削除したりできる。隠された件数は Review Stacks の右上に出る。

## Sub-features

- `pf-add`: `Match against` (Title / Branch) とパターンを入れて `Add`。2 文字未満では `Add` が押せない
- `pf-effect`: 有効なフィルタに当たる PR が Review Stacks と Throughput から消え、Review Stacks に `1 PR hidden` が出る
- `pf-toggle`: 行の switch で無効にすると PR が戻る
- `pf-delete`: 行のゴミ箱 → 確認ダイアログ `Delete filter` の `Delete` で消える
- `pf-manage-link`: Review Stacks の hidden メニューの `Manage filters…` からこの画面に来る (admin のみ)

## How to get to it (user POV)

- Settings → sidebar の `PR Filters`
- Review Stacks 右上の hidden メニュー → `Manage filters…`

## Driving it with upflow-verify

Preconditions:

- doctor がすべて OK
- `pr_title_filters` が空 (seed の状態)
- `#102 Implement SSO login flow` が open

シナリオ: `upflow-verify drive <RUN_ID> .claude/skills/verify-upflow/scenarios/pr-filters.mjs`

- **前の状態。** `/techtalk/workload` に button `techtalk/backend#102 (In review)` と button `No PRs hidden. Choose which PRs to hide` がある。
- **追加。** Settings の link `PR Filters`。combobox `Match against` で `title`、textbox `e.g. [DO NOT MERGE]` に `SSO login`、button `Add`。row `SSO login` が出て、その switch が checked。`sql('tenant', "select target, pattern, is_enabled from pr_title_filters ...")` が `title / SSO login / 1` を返す。
- **効果。** `/techtalk/workload` から `techtalk/backend#102 (In review)` が消え、button `1 PR hidden. Choose which PRs to hide` が出る。`/techtalk/throughput/ongoing` から link `Implement SSO login flow` が消える。
- **無効化。** row `SSO login` の switch を押す。checked でなくなり、DB の `is_enabled` が 0 になる。Review Stacks に `#102` が戻る。
- **削除。** row `SSO login` の button (ゴミ箱) を押す。alertdialog `Delete filter` の button `Delete`。cell `No filters yet.` が出て、DB の行も消える。
- **証拠。** `before-review-stacks`、`filter-added`、`review-stacks-filtered`、`ongoing-filtered`、`review-stacks-after-disable`、`delete-confirm`、`filter-deleted`、`db-after-add.json`、`db-after-delete.json`。

## Gotchas

- 行の switch とゴミ箱の button には accessible name が無い。row を名前で取ってから、その中の `switch` / `button` を選ぶ
- パターン入力の textbox の名前は placeholder で、`Match against` が `Branch` だと `e.g. release/` に変わる
- フィルタを残したまま他の journey を流すと、Throughput や Analysis の件数が変わる。journey の最後で必ず削除する
- `Add` は fetcher で送るので、画面が遷移しない。row が出るのを待ってから DB を見る
