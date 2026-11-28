---
name: verify-upflow
description: upflow の Web UI (Review Stacks、Throughput、Analysis、Settings) を、使い捨ての DB と本番ビルドで起動し、seed の admin でログインした Playwright で実際に操作して、screenshot・ARIA snapshot・DB の行を証拠に残す。画面や loader / action、クエリ、seed、認証まわりを変えたあと、「ユニットテストは通るが画面で本当に動くか」を確かめるときや、PR に動作の証拠を付けるときに使う。
---

# upflow を実際に動かして確かめる

ユニットテストや `pnpm test:e2e` (ダッシュボードの見出しを 1 つ見るだけ) では分からない、「ユーザーが画面で操作したら期待どおりになるか」を確かめるための手順。開発用の `./data` や `pnpm dev` には触らず、run ごとに別の DB・ポートで本番ビルドを立てる。

道具はすべて `scripts/upflow-verify` (この skill の中) にある。以下 `V=.claude/skills/verify-upflow/scripts/upflow-verify` とし、repo のルートで実行する。

## 前提

- `pnpm install` 済み。Node は `package.json` の `devEngines` (24.x) を pnpm が用意する。システムの `node` の版は問わない
- `atlas` が PATH にある (`curl -sSf https://atlasgo.sh | sh`)
- Playwright の Chromium (`pnpm exec playwright install chromium`)。repo の Playwright と版が合わないブラウザしか無い環境では `PW_CHROMIUM_PATH=<chrome の実行ファイル>` を渡す
- `curl`、`lsof` (無ければ doctor の port 確認だけ飛ばす)

## Launch

```bash
$V launch            # RUN_ID は自動 (例 20261128-120000-1234)。名前を付けるなら $V launch my-run (英数字と . _ -)
```

やること:

1. `build/` が無いか、`app/` などのソースや `package.json` / `pnpm-lock.yaml` より古いか、client bundle に Sentry の DSN が焼き込まれていれば、`VITE_SENTRY_DSN` を空にして `pnpm build` (1-2 分)
2. `${TMPDIR:-/tmp}/upflow-verify/<RUN_ID>/data` に空の DB を作り、shared の migration (atlas)、integrations の移行、tenant の migration、`db/seed.ts` を流す。job queue (`durably.db`) と seed が書く `tenant_seed.db` もこの中に作られるので、開発用の `./data` や `pnpm dev` の job queue とは混ざらない
3. 8820-8899 の空きポートで `node server.mjs` を `NODE_ENV=test ENABLE_E2E_LOGIN=1` で起動する。`.env` の Sentry・GitHub・Gemini の値は空かダミーで上書きし、定期 crawl も止める (`DISABLE_JOB_SCHEDULER=1`)
4. `/healthcheck` が 200 で、かつ seed の admin で `/test-login` が 302 を返すまで待つ (DB が空だと healthcheck だけ通ってログインできない)。`lsof` があれば、答えているのがこの run の process であることも確かめる

`ready: run=<RUN_ID> url=http://localhost:<port> ...` が出たら使える。60 秒で ready にならなければ server.log の末尾を出して失敗する。そのときも `$V stop <RUN_ID>` で片付ける。

同じ checkout から複数の run を並べて起動してよい (DB・ポート・証拠は run ごと)。launch 自体は 1 つずつ進む (build、atlas のロック、ポートの取り合いを避けるため。後から来た launch は待つ)。ただし `build/` は checkout で 1 つなので、run の途中でソースを変えたら doctor が FAIL になる。stop して launch し直す。

## Doctor

```bash
$V doctor <RUN_ID>   # すべて OK なら exit 0
```

読み取りだけで、process が生きているか、port を listen しているのがこの run の process か、healthcheck、seed admin でログインできるか、使い捨て DB があるか、起動時と同じ commit か、`build/` がソースより新しいかを見る。最初の drive の前と、drive が予想外の失敗をしたあとに必ず実行する。FAIL が出た instance は操作しない。stop して launch し直す。

`$V list` でこの helper が起動した run を一覧できる。

## Drive

```bash
$V drive <RUN_ID> .claude/skills/verify-upflow/scenarios/pr-filters.mjs
```

シナリオは `export default async (ctx) => {}` を持つ `.mjs`。`scripts/drive.mjs` が Chromium (1440x900、`ja-JP`、`Asia/Tokyo`) を開き、seed の admin (`admin@example.com`、org `techtalk` の owner で superadmin) で `/test-login` してからシナリオを呼ぶ。`ctx` の中身:

| 名前                       | 使い方                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `page`, `context`          | Playwright の Page / BrowserContext。`page.goto('/techtalk/...')` は相対パスでよい                                     |
| `expect`                   | `@playwright/test` の expect (自動で待つ)                                                                              |
| `capture(name)`            | 今の画面の ARIA snapshot (`NN-name.aria.yml`) とフルページ screenshot (`NN-name.png`) を残す                           |
| `sql(which, sql, params?)` | 使い捨て DB を読み取り専用で引く。`which` は `shared` (`data.db`) か `tenant` (`tenant_<orgId>.db`)。列名は snake_case |
| `record(name, value)`      | 任意の値 (DB の行など) を `name.json` として残す                                                                       |

対象を選ぶときは role と accessible name (`getByRole('button', { name: '...' })`) を使い、座標や CSS class は使わない。アプリの画面文言は英語。各画面の handle は `features/` にある。

用意済みのシナリオ (`scenarios/`) は `features/` の各ファイルの journey をそのまま実装したもの。変更を確かめるときは、触った機能のシナリオを流し、足りなければ同じ形でシナリオを書く (使い捨てなら repo の外に置いてよい)。DB を外から書き換えたり、内部の API を直接叩いたりして近道しない。ユーザーが通る画面の操作で状態を作る。

DB を直接見たいとき:

```bash
$V sql <RUN_ID> tenant "select number, title, state from pull_requests where state = 'open'"
```

## Evidence

drive 1 回ごとに `tmp/verify-evidence/<RUN_ID>/<scenario>-<YYYYMMDD-HHMMSS>-<pid>/` (repo の `tmp/` は git 管理外) に残る。場所は `UPFLOW_VERIFY_EVIDENCE` で変えられる。

- `NN-<name>.png` と `NN-<name>.aria.yml`: 操作の前と後の両方を撮る。最後の画面だけでは証拠にならない
- `<name>.json`: `record` で残した DB の行。画面に出たことと、DB に書かれたことを両方確かめる
- `summary.json`: 成否、エラーの stack、各 step の URL、ブラウザの console error と page error。PASS でも `consoleErrors` が空でなければ中身を読む (SSR とブラウザの時差による hydration エラーはここに出る)
- 失敗したときは `NN-FAILED.png` / `.aria.yml` が最後に撮られる

証拠の基準:

- ユーザーが通る道 (sidebar、ボタン、フォーム) で操作する。テスト用の近道は `/test-login` によるログインだけ
- 書き込みを伴う機能は、画面の変化と DB の行 (`sql`) と、別の画面での見え方 (例: フィルタを足したら Review Stacks から PR が消える) の 3 つで確かめる
- seed に journey の前提が無ければ、journey を弱めずに失敗として報告し、理由を該当 feature の Gotchas に足す

## Cleanup

```bash
$V stop <RUN_ID>     # 複数指定できる
```

この run が記録した pid が `server.mjs` を動かしているときだけ TERM (10 秒で止まらなければ KILL) し、`${TMPDIR:-/tmp}/upflow-verify/<RUN_ID>/` (DB、ログ) を消す。プロセス名で kill はしない。証拠 (`tmp/verify-evidence/<RUN_ID>/`) は消さない。失敗した試行のあとも毎回 stop する。

## 機能の地図

`features/README.md` から始める。いまある地図: Review Stacks、Throughput、Analysis、PR Filters、Teams。画面を足したり文言を変えたりしたら地図も直す。地図全体の点検は pstack の `/maintain-verification-skill` で行う。
