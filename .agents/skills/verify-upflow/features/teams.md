# Teams

Teams は repository をまとめるチームを作る設定。チームには並び順と、1 人が同時に抱えてよい PR の数 (Limit、既定 2) がある。Repositories の一覧でチームごとに絞れ、ダッシュボードは URL の `?team=<team id>` で絞られる。

## Sub-features

- `tm-add`: チーム名を入れて `Add`。Limit は 2、Order は 0 で作られる
- `tm-edit`: 表のセルを押して名前・Order・Limit をその場で直す
- `tm-delete`: 行のゴミ箱 → 確認ダイアログ `Delete Team` の `Delete`

## How to get to it (user POV)

- Settings → sidebar の `Teams`

## Driving it with upflow-verify

Preconditions:

- doctor がすべて OK
- `teams` が空 (seed の状態)

シナリオ: `upflow-verify drive <RUN_ID> .claude/skills/verify-upflow/scenarios/teams.mjs`

- **追加。** Settings の link `Teams`。heading `Teams`、textbox `Enter team name` に `Verify Platform`、button `Add`。row `Verify Platform` が出る。`sql('tenant', "select name, personal_limit from teams ...")` が 1 行、`personal_limit` 2 を返す。
- **残ることを確かめる。** reload しても row `Verify Platform` がある。
- **削除。** row `Verify Platform` の最後の button (ゴミ箱)。alertdialog `Delete Team` の button `Delete`。cell `No teams registered yet.` が出て、DB の行も消える。
- **証拠。** `team-added`、`delete-confirm`、`team-deleted`、`db-after-add.json`、`db-after-delete.json`。

## Gotchas

- ゴミ箱の button には accessible name が無い。row の中の最後の button を選ぶ
- `tm-edit` (セルのその場編集) はまだシナリオで操作していない
- チームを残すと Review Stacks の上限の点線と Repositories の絞り込みが変わる。journey の最後で削除する
