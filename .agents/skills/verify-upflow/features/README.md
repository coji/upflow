# upflow の検証の地図

upflow のユーザーから見た機能を確かめるための正本。操作の前にこの README を読み、該当する機能のファイルを手順として使う。

## 共通の前提

- `upflow-verify launch` で起動した run だけを操作する。`pnpm dev` や他人の instance は操作しない
- 最初の drive の前に `upflow-verify doctor <RUN_ID>` がすべて OK
- seed の状態から始める: org `techtalk` (TechTalk)、repository `techtalk/frontend` と `techtalk/backend`、GitHub ユーザー `alice` `bob` `charlie` `diana` `evan` (と `test_user`)、merged の PR が 90 日前から今週まで、open の PR が `#101`-`#108` (`#103` と `#107` は draft)。チームと PR フィルタは無い
- ログインするのは seed の admin (`admin@example.com`、org の owner で superadmin) だけ。`/test-login` は他のメールを 404 にする

## 操作の決まり

- 画面の文言は英語。role と accessible name で要素を選ぶ
- 日時は seed を作った時刻からの相対 (`daysAgo`)。週や件数は launch した日によって変わるものがある。各 feature の Gotchas を見る
- 書き込みを伴う journey は、最後に自分で作ったものを消して seed の状態に戻す (run を捨てるなら不要だが、同じ run で次の journey を流すなら必要)
- 証拠は消さない

## 証拠の出し方

- 操作の前と後の両方を `capture` する
- 書き込みは画面、DB の行 (`sql` + `record`)、別の画面での効果の 3 つで示す
- 届かなかった道は、試した操作と満たせなかった前提を書いて報告する。別の道で確かめたものを、その道の確認として報告しない

## 各ファイルの形

H1 のあとに 1 段落でユーザーに見える振る舞いを書き、H2 を次の順に 4 つ置く: `Sub-features` (短い ID と 1 行)、`How to get to it (user POV)` (ユーザーの入口をすべて)、`Driving it with upflow-verify` (`Preconditions:` から始め、操作・handle・見えるはずの結果を対にする)、`Gotchas`。実装の詳細は書かない。

## 機能

- [Review Stacks](./review-stacks.md): 書いた PR とレビュー待ちの 2 列、PR の popover、メンバーの drill-down
- [Throughput](./throughput.md): Ongoing / Merged / Deployed の表と週送り
- [Analysis](./analysis.md): Cycle Time、Review Bottleneck、Inventory、Feedbacks のグラフ
- [PR Filters](./pr-filters.md): タイトル・ブランチのパターンで PR を全画面から隠す (追加、無効化、削除)
- [Teams](./teams.md): チームの追加と削除

まだ地図に無い画面: Settings の General / Integration / Members / Repositories (追加は GitHub が要る) / GitHub Users / PR Types / Export / Data Management / Danger Zone、`/admin` (org の一覧と作成)、PR ごとの画面 (`/techtalk/settings/repositories/<id>/<number>`)。
