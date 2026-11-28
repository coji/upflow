---
name: verify-crawl-watermark
description: crawl ジョブの scan watermark と githubRawData への保存を TLA+ でモデル検査する。crawl.server.ts、scan-watermark.ts、fetcher.ts の pullrequestList / paginateGraphQL、store.ts の savePrData / setScanWatermark、crawl を trigger する箇所 (webhook、job-scheduler、repositories.add)、PR 画面の refresh、concurrency key、durably の設定や coalesce を変えたとき、または「PR の更新が取り込まれない」「ダッシュボードの PR が古いまま」を調べるときに使う。
---

# crawl の scan watermark を検査する

## 何を確かめているか

- **守る約束 (`Converged`)**: PR の更新が止まり、webhook がすべて処理され、そのあと定期の crawl が 1 回、取得の失敗なく終わったら、どの PR も `githubRawData` に GitHub の最新の内容が入っている。
- **破れたときの害**: scan watermark (全件取得をどこまで終えたかの印。次の crawl はこの時刻より新しい PR だけを一覧する) が、最新の内容を取れていない PR を越えて進むと、その PR は二度と一覧されない。誰かがその PR をまた更新するまで、ダッシュボードに古い内容が出続け、誰も気づかない。
- **2 つめの規則 (`RawNeverGoesBack`)**: `githubRawData` の行が、すでに入っていた新しい内容より古い内容で上書きされない。破れると、次にその PR を取り直すまで古い内容が出る。

モデルは `verification/crawl-watermark/CrawlWatermark.tla`。TLC (TLA+ のモデル検査器) が、決めた範囲のすべての実行順を調べる。

## いつ使うか

次のどれかに触れる変更をしたら、push の前に実行する。

| ファイル                                                                   | モデルの中で対応するもの                                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/services/jobs/crawl.server.ts` (`crawlJob`)                           | `CrawlStarts` から `CrawlEnds` までの各手順。`fetch-prs` の step で取る `listStartedAt` は `PrListFetched` の `ls`。`repoUpdated` に入れる条件は `PrSaved` の `saved`、`computeAdvancedScanWatermark` の呼び方は `WatermarkStep` |
| `app/services/jobs/scan-watermark.ts` (`computeAdvancedScanWatermark`)     | `WatermarkStep` の `NewWatermark`、切り替え `AdvanceNeedsAllSaved` / `TargetedNeverAdvances` / `CapAtListTime`、環境 `ClockAhead`                                                                                                |
| `batch/github/fetcher.ts` (`pullrequestList`, `paginateGraphQL`)           | `PrListFetched`、切り替え `StopInclusive`、環境 `PartialListing`                                                                                                                                                                 |
| `batch/github/store.ts` (`getFetchedAt`, `savePrData`, `setScanWatermark`) | `PrFetchBegins` の `tok`、`PrSaved`、切り替え `SaveRule`、`WatermarkStep` の上書き                                                                                                                                               |
| `app/services/github-webhook-pull.server.ts`                               | `WebhookHandled` (coalesce `skip`)                                                                                                                                                                                               |
| `batch/job-scheduler.ts`                                                   | `HourlyTrigger` (coalesce なし。pending があれば ConflictError で何も積まれない)                                                                                                                                                 |
| `app/routes/$orgSlug/settings/repositories.add/index.tsx`                  | `RepoAdded` (別の concurrency key `crawl:<org>:<repo>`)                                                                                                                                                                          |
| `batch/github/fetch-and-save-pr.ts` (`fetchAndSavePr`)                     | `PrFetchBegins` から `PrSaved` まで (行の `fetchedAt` を読んでから GitHub を読み、保存する)                                                                                                                                      |
| `app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx`    | `PageRefresh` (リクエストの中で `fetchAndSavePr` を呼ぶ。durably の外)                                                                                                                                                           |
| `app/services/jobs/concurrency-keys.server.ts`                             | `Keys` / `CrawlKeys`                                                                                                                                                                                                             |
| `app/services/durably.server.ts`                                           | `CrawlStarts` の `Workers` (1 プロセスに worker 1 つ、`maxConcurrentRuns` の既定値 1)                                                                                                                                            |
| `@coji/durably` の更新                                                     | `Trigger` (pending が 1 つあれば新しい依頼は捨てられる)、`CrawlStarts`                                                                                                                                                           |

durably の動きは `node_modules/@coji/durably/docs/llms.md` の "With coalesce" と `maxConcurrentRuns` の説明が正本 (0.16.1 で確認)。`opensrc/` にある durably は 0.14.0 で古い。

## 実行

```bash
verification/crawl-watermark/check.sh            # 全モデル。1 分半ほど
verification/crawl-watermark/check.sh code       # 1 つだけ
verification/crawl-watermark/check.sh --accept   # 全モデルを回し、今のコードを確認済みとして記録する
```

初回だけ mise で Java (temurin 21.0.13) を入れ、TLC (`tla2tools.jar` 1.7.4、sha256 で確認) を `.cache/tla/` に落とす。どちらもネットワークが要る。

スクリプトは次の順に動く。

1. コードの 5 か所の書き方を文字列で読み、モデルの切り替えの値を決める (`Code switches:` の行)。
2. 各モデルを TLC にかけ、期待した結果と比べる。設定と出力は `tmp/crawl-watermark/<model>.cfg` と `.out` に残る。
3. 対象ファイルの中身が、最後にモデルと照らして確認した版 (`SYNC_HASH`) と同じかを見る。

| 終了コード | 意味                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| 0          | 全モデルが期待どおりで、対象ファイルも確認済みの版のまま。合格                             |
| 1          | 期待と違う結果のモデルがある                                                               |
| 2          | 動かせない (ツールの取得失敗、または切り替えの文字列がコードにない)                        |
| 3          | 全モデルは期待どおりだが、対象ファイルが確認済みの版から変わっている。**まだ合格ではない** |

終了コード 3 は「モデルが今のコードを表しているか、誰も確かめていない」という意味。切り替えの文字列 5 か所以外の変更 (たとえば `crawl.server.ts` の手順の順番や、trigger の coalesce の指定) は、モデルが自動では拾えない。下の「コードが変わったとき」に従う。

## 結果の読み方

| モデル                      | 期待                    | 意味                                                                                                                                                                                 |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `code`                      | pass                    | 今のコード、worker 1 つ (本番はサーバー 1 プロセス)。途中でリポジトリが追加され、一覧を読んだのと同じ秒にも PR が変わりうる。GitHub は一覧を欠けずに返す。変更の合否はまずこれで見る |
| `code-page-refresh`         | pass                    | `code` に PR 画面の refresh を 1 回足す。refresh と crawl が同じ PR を同時に取っても、行が古い内容で上書きされず、最後は最新になること                                               |
| `code-second-worker`        | pass                    | worker 2 つ (同じ `data/durably.db` で `batch/cli.ts` などを動かしたとき)。追加用の crawl と組織の crawl が同時に走っても、古い内容で上書きされず、最後は最新になること              |
| `assumption-clock-ahead`    | `Converged` 違反        | 前提を外した版。サーバーの時計が GitHub より余裕 (`SCAN_WATERMARK_CLOCK_MARGIN_MS`) 以上進んでいると、上限が効かず同じ秒の更新を失う。この前提にモデルが頼っていることの確認         |
| `finding-partial-list`      | `Converged` 違反        | 既知の問題 1                                                                                                                                                                         |
| `mutant-advance-on-failure` | `Converged` 違反        | わざと壊した版。保存に失敗した PR があっても watermark を進める。検査が失敗できることの確認                                                                                          |
| `mutant-targeted-advances`  | `Converged` 違反        | わざと壊した版。webhook の取得 (PR 番号を指定した取得) で watermark を進める                                                                                                         |
| `mutant-no-list-time-cap`   | `Converged` 違反        | わざと壊した版。watermark を一覧の最新の `updatedAt` のままにし、一覧を読んだ時刻で抑えない (直す前のコード)。同じ秒の更新が失われる                                                 |
| `mutant-fetchedat-guard`    | `RawNeverGoesBack` 違反 | わざと壊した版。保存の条件を直す前の「読む前に取った `fetchedAt` が新しいほうを残す」に戻す。`code-page-refresh` と同じ範囲で、refresh と crawl の同時取得で新しい内容が消える       |

- `FAIL  code  expected pass, got Converged` は、変更で約束が破れたか、モデルがコードとずれたかのどちらか。次の節で見分ける。
- `FAIL  finding-*  expected ..., got pass` は、既知の問題が今のコードで再現しなくなったということ。直したのなら、その設定を `code-*` に変えて期待を `pass` にするか、直す前の書き方を `mutant-*` として残し、下の「既知の問題」から消す。
- `MODEL OUT OF DATE` は、切り替えを読む文字列がコードから消えたということ。そのファイルを読み直し、モデルと `check.sh` の文字列を直す。
- `NOTE: SaveRule: no save rule found` は、`savePrData` の保存の条件の文字列がないので、条件なし (いつも上書き) としてモデルを回したということ。条件を書き換えただけなら、`check.sh` の `SaveRule` を読む文字列を直す。
- `NOTE: ... guard not found` は、ガードの文字列がないので、ガードなしとしてモデルを回したということ。ガードを別の場所に移しただけなら、文字列を直す。`TargetedNeverAdvances` だけは注意: webhook の取得は `prsToFetch` に `updatedAt` を入れず、`listStartedAt` も `null` なので、`if (isTargetedFetch) return null` を消しても実際には watermark は進まない。この行を消したときの `code` の失敗は、モデルがコードより厳しいだけのことがある。`crawl.server.ts` で `prsToFetch` に `updatedAt` が入るか、`listStartedAt` が入るかを見て判断する。
- `NOTE: @coji/durably is ...` は、durably の版がモデルの前提と違う。docs を読み直し、`Trigger` と `CrawlStarts` が今の動きと合うか確かめる。
- `got error` は TLC が spec を読めなかったか、途中で止まった。`.out` の先頭を読む。

## 本物のバグか、モデルの誤りか

違反が出たら、TLC の反例 (違反に至る最短の手順) を pstack の `/statechart` スキルで読む。spec は `verification/crawl-watermark/CrawlWatermark.tla`、設定は `tmp/crawl-watermark/<model>.cfg`、状態と手順の言葉は `verification/crawl-watermark/view.ts` を渡す。実行の仕方は `/statechart` スキル自身に従う。どのモデルも状態の数が図の上限より多いので、図には違反に至る経路だけが出る。違反のないモデルの全体の図がほしいときは、定数を小さくした設定を別に作る。

1. 反例の各手順を、上の表でコードの場所に置き換え、PR の言葉で 1 行ずつ書く (例: 「定期の crawl が PR 一覧を読む」「PR 1 が更新され webhook が届く」)。
2. 各手順が、コードの上で本当にその順で起きうるかを確かめる。モデルで 1 手順になっているものが、コードでも途中に割り込まれない処理かを見る。たとえば `PrDetailsRead` は `Promise.all` の 6 つの取得をまとめて 1 手順にしている。2 つの crawl が同時に進む経路なら、worker がいくつあるかも見る。
3. どの手順もコードで起きうるなら本物のバグ。起きえない手順があるなら、モデルがコードより広すぎる。モデルを直す前に、なぜ起きえないかをコードの行で示す。
4. 本物のバグなら、規則やモデルを弱めて通さない。反例をコードの言葉で報告し、製品コードを直すかは依頼者が決める。

## コードが変わったとき

終了コード 3 のとき、または上の表のファイルを変えたとき:

1. `check.sh` が出す `git diff --stat` のファイルごとに、変更を読み、表の行と照らす。
2. 変更がモデルの手順を変えるなら、モデルを直す。新しい手順や trigger を足したら、モデルに action を足し、表にも行を足す。切り替えの書き方を変えたら、`check.sh` の `switch_value` の文字列を直す。
3. 規則を変えてよいのは、約束そのものが変わったときだけ。そのときは「何を確かめているか」も書き直す。
4. `check.sh` を回し、`mutant-*` がまだ失敗することを見る。壊した版が通るなら、その検査は何も確かめていない。
5. モデルが今のコードを表していると確かめられたら、`check.sh --accept` を回す。`SYNC_HASH` と `SYNC_COMMIT` が書き換わる。下の「同期の記録」のコミットも同じ値にする。確かめずに `--accept` しない。

## 範囲と前提

検査の範囲: リポジトリ 1 つ、PR 2 つ、GitHub の時刻は 0〜2 秒、PR の更新は 2 回まで、取得の失敗は 1 回まで、更新が止まる前の定期 crawl の依頼は 2 回まで。`code-page-refresh`、`code-second-worker`、`mutant-fetchedat-guard` は、同時に進む実行が増えて状態が多くなるので、時刻 0〜1、失敗 0 回、定期 crawl 1 回に縮めている。`code-second-worker` は同じ秒の更新も外している (同じ秒の扱いは `code` が見る)。pass はこの範囲の中でだけ言える。

モデルが置いている前提:

- `updatedAt` は秒の精度。保存が通るたびに、その行の `fetchedAt` は前より後の値になる (`nextFetchedAt`)。モデルは行ごとの書き込み回数で表す。
- サーバーの時計は GitHub の時計より `SCAN_WATERMARK_CLOCK_MARGIN_MS` (5 分) 以上進んでいない。モデルの 1 秒がこの余裕を表す。外すと `assumption-clock-ahead` のとおり同じ秒の更新を失う。
- PR 一覧は一度に読む。ページの間に PR が更新されて順位が変わる場合は扱わない (その PR の新しい `updatedAt` は一覧のどれよりも新しいので、次の crawl が拾う)。
- PR の詳細 6 種類は同じ時点の内容として読む (`PrDetailsRead` は 1 手順)。今の保存の条件は、6 つの取得がどれも行の `fetchedAt` を読んだあとに始まることだけに頼るので、これで足りる。読み終えた時刻で順番を決める書き方が足りないこと (6 つの取得が相手の取得と入り混じる) は、このモデルでは示せない。`store.ts` の `savePrData` のコメントに理由を書いた。
- GitHub は、ある時点より後に始めた読み取りに、その時点より古い内容を返さない。
- webhook は必ず届く。GitHub が webhook を落とす場合は扱わない。そのときは定期 crawl だけが頼りで、その PR の `updatedAt` が watermark より新しければ拾える。
- PR を処理する順番は自由にしている (コードは `updatedAt` の新しい順)。

扱っていないもの: durably の再試行と再開 (step の結果の再利用、lease の期限切れ)、`refresh: true` の crawl、`backfill` (`updatePrMetadata` は `savePrData` と同じ条件で書くが、モデルには入れていない)、タグの取得、process ジョブ (`processed_at` と集計への反映)、PR が 3 つ以上やリポジトリが 2 つ以上の場合。

`computeAdvancedScanWatermark` の中身がモデルとずれていないかは、`pnpm vitest run app/services/jobs/scan-watermark.test.ts` が確かめる。`check.sh` は関数の中の 3 行を文字列で見ているだけなので、この関数を変えたらテストも回す。

## 直した問題

- **一覧を読んだのと同じ秒の更新が、二度と取得されない** (`mutant-no-list-time-cap` が直す前の形)。GitHub の `updatedAt` は秒の精度で、一覧を読んだ秒はまだ終わっていない。watermark を一覧の最新の `updatedAt` にすると、その秒のうちに一覧のあとで更新された PR は `updatedAt <= watermark` になり、webhook の取得も待っている crawl に合流して捨てられると、二度と一覧されなかった。今は watermark を「一覧を読み始めた時刻 − 5 分」で抑えている。`fetcher.ts` の `<=` は #276 で毎時の無駄な取り直しをなくすために選んだもので、変えていない。

- **同じ PR を 2 か所で同時に取ると、新しい内容が古い内容で上書きされる** (`mutant-fetchedat-guard` が直す前の形)。PR 画面の refresh と crawl、または worker 2 つのときの 2 つの crawl で起きた。直す前は、GitHub を読む前に取った `fetchedAt` が新しいほうを残していたが、先に読み始めた取得のほうが新しい内容を読むことがある。今は、読む前に行の `fetchedAt` を控え、保存のときにそれが変わっていなければ書く (`fetchAndSavePr`、`savePrData`)。書けなかった取得は失敗と同じに扱うので、crawl は watermark を進めず、次の crawl がその PR を取り直す。PR 画面の refresh は、保存できなかったことを画面に出す。`backfill` の `updatePrMetadata` も同じ条件にした。

## 既知の問題

1. **GitHub が一覧の一部を null で返すと、その PR を越えて watermark が進む** (`finding-partial-list`)
   - `paginateGraphQL` は GraphQL の部分エラーのとき部分データを使い、null の node を黙って飛ばす。飛ばした PR より新しい PR が一覧にあれば、watermark はそこまで進み、飛ばした PR は二度と一覧されない。
   - GitHub が実際にこう返すかは、このモデルでは分からない。返すなら問題になる、という条件つきの発見。

## 同期の記録

- 同期コミット: `6c9cd59c` (`check.sh` の `SYNC_COMMIT`)。対象ファイルの中身の hash は `check.sh` の `SYNC_HASH`。
- 対象ファイル: 上の表のファイル (`check.sh` の `COVERED`)。

`SYNC_HASH` と `SYNC_COMMIT` を進めてよいのは、「コードが変わったとき」の手順でモデルが今のコードを表していると確かめたあとだけ。
