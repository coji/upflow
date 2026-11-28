# Review Stacks

Review Stacks は org のトップ画面で、メンバーごとに「自分が書いた open の PR」と「自分にレビュー依頼が来ている PR」を丸の列で並べ、偏りを見せる。丸を押すと PR の概要が popover で出て、名前を押すとそのメンバーの詳細に入る。

## Sub-features

- `rs-redirect`: `/techtalk` を開くと `/techtalk/workload` に移る
- `rs-columns`: `Authored PRs (open)` と `Review Queue (pending)` の 2 列に、メンバーと件数と PR の丸が並ぶ
- `rs-popover`: PR の丸を押すと PR のタイトルなどが popover に出る
- `rs-drilldown`: メンバー名から `/techtalk/workload/<login>` に入り、`← Review Stacks` で戻る
- `rs-hidden-menu`: 右上の `No PRs hidden` / `N PR(s) hidden` メニューで隠す理由を切り替える (PR Filters と組で確かめる)

## How to get to it (user POV)

- ログイン直後、または org を選んだとき (`/techtalk`)
- sidebar の Workload → `Review Stacks`
- メンバーの詳細画面の `← Review Stacks`

## Driving it with upflow-verify

Preconditions:

- doctor がすべて OK
- seed の open PR `#101`-`#108` がそのまま

シナリオ: `upflow-verify drive <RUN_ID> .claude/skills/verify-upflow/scenarios/review-stacks.mjs`

- **トップを開く。** `page.goto('/techtalk')`。URL が `/techtalk/workload` になり、heading `Review Stacks` (level 1)、heading `Authored PRs (open)` と `Review Queue (pending)` が出る。
- **PR の丸。** button `techtalk/frontend#101 (In review)` と、draft の button `techtalk/frontend#107 (In review, Draft)` が見える。同じ PR が両方の列に出るので `.first()` で選ぶ。
- **popover。** button `techtalk/backend#102 (In review)` を押す。role `dialog` に `Implement SSO login flow` が出る。`Escape` で閉じる。
- **drill-down。** link `alice Alice Chen` を押す。URL が `/techtalk/workload/alice`、heading `Alice Chen` (level 1)、`Authored 2`、`Review Queue 4` が出る。link `← Review Stacks` で戻る。
- **証拠。** `review-stacks`、`pr-popover`、`drill-down-alice` の 3 枚。

## Gotchas

- `/techtalk` の heading は redirect の後に出る。URL を `/workload$` で待ってから見出しを見る
- 丸の accessible name は `<owner>/<repo>#<number> (<状態>[, Draft])`。状態の文言 (`In review`、`Approved` など) が変わると handle も変わる
- drill-down では draft の印が名前に付かない (Review Stacks では `#103` が `(In review, Draft)`、`/workload/alice` では `(In review)`)。drill-down で draft を確かめる journey はこの違いに注意する
- URL に `?team=<team id>` を付けるとそのチームで絞られる。チームがあると、丸の列の点線 (1 人あたりの上限) がチームの Limit の最大値になる。Teams の journey の後は作ったチームを消してから流す
