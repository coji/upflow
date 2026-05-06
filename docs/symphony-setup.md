# Symphony — Fly machine setup runbook

issue #370 で設計した Symphony port の実行基盤を、Fly.io 上の小さな VM 1 台に載せる。Fly ではこの単発 VM を machine と呼ぶ。machine 内には HTTP server が常駐し、port 8080 で `/tick` という起動兼処理依頼の窓口を公開する。GitHub Actions の cron は 15 分おきに `/tick` に POST を投げ、受けた machine は `symphony:ready` ラベルが付いた issue を 1 件取って takt の `spec-implement-accept` ワークフローにかけ、draft PR まで作る。`symphony:ready` は「この issue は Symphony に任せてよい」という人間からの合図で、人間が貼ったときだけ machine が動く。

なにも処理しない状態が 5 分続けば machine は自分で停止し、以降は Fly volume の固定課金だけが残る。次に cron が `/tick` を投げると Fly が再び machine を起動して同じサイクルが回る。

過去に sprites.dev で同じ仕組みを試みた記録は [docs/symphony-setup-sprite.md](./symphony-setup-sprite.md) に残してある。sprites のアイドル hibernation 仕様で D2 案が成立しなかった経緯が書いてある。

## 前提

- Fly.io アカウント (upflow 本体が既に Fly 上にあるなら同じアカウント)
- 利用可能な subscriptions: Claude Max / Codex Plus / Cursor Pro
- GitHub アカウント (push 権限のあるリポジトリ)
- ローカル環境: `flyctl` (upflow 本体の deploy で既に install 済みのはず)

## 1. Fly app と Volume を作る

```bash
# 設定ファイルは infra/symphony/fly.toml に置いてある
flyctl apps create upflow-symphony
flyctl volumes create symphony_data \
  --app upflow-symphony \
  --region nrt \
  --size 5
```

`5GB` で repo + node_modules + agent token + 過去 run のログを十分賄える。後から拡張可。

## 2. Tick token を生成して両側に登録

```bash
TOKEN=$(openssl rand -hex 32)
flyctl secrets set SYMPHONY_TICK_TOKEN="$TOKEN" --app upflow-symphony
gh secret set SYMPHONY_TICK_TOKEN --body "$TOKEN"
gh secret set SYMPHONY_URL --body "https://upflow-symphony.fly.dev"
```

Fly secrets と GitHub Actions secrets の両方に同じ値を入れる。GitHub Actions cron がこの token で Fly machine を叩く。

ついでに dotenv 検証用のスタブシークレットも入れる。symphony 自体は OAuth に出ないが、`app/libs/dotenv.server.ts` がスキーマ検証で `*_SECRET` 系の存在を要求するので、ダミー値で埋める必要がある。**コミット済 fly.toml ではなく `flyctl secrets` 側に置く**: 平文の `*_SECRET` をソース管理に混ぜると、将来本物のシークレットを誤コミットする習慣が芽生えるので分離する:

```bash
flyctl secrets set \
  BETTER_AUTH_SECRET="symphony-preflight-dummy-secret-32+chars-not-a-real-secret" \
  GITHUB_CLIENT_SECRET="symphony-dummy" \
  --app upflow-symphony
```

## 3. 初回 deploy (auth 前なので機能しないが、SSH 用に machine を起こす目的)

```bash
flyctl deploy \
  --app upflow-symphony \
  -c infra/symphony/fly.toml \
  --dockerfile infra/symphony/Dockerfile
```

container は `gh auth` 未設定を検知して `sleep infinity` に入る (`infra/symphony/entrypoint.sh` 参照)。エラーログが出ていても正常。

## 4. SSH で interactive auth を一回だけ

```bash
flyctl ssh console --app upflow-symphony -u symphony
# 以下、container 内 (HOME は /data/home に自動設定済み)

gh auth login                        # GitHub device flow
claude auth login --claudeai          # Claude Max
codex login --device-auth             # Codex Plus (remote: device flow)
cursor-agent login                    # Cursor Pro

# 全部成功してることを確認 (すべて /data/home 配下に保存されているはず)
gh auth status
claude auth status
ls $HOME/.codex/auth.json $HOME/.config/cursor/auth.json
exit
```

`-u symphony` で SSH すると、container 内のサービスユーザー (uid 1001) として log in する。同じ uid で auth ファイルを書くので、`pnpm symphony:serve` がそのまま読める。`/etc/profile.d/symphony-home.sh` が SSH session の `HOME` を `/data/home` に固定しているので、保存先は自動的に Volume 配下になり、machine restart や image rebuild を跨いで永続化する。`codex login` は browser-redirect 形式で remote machine だと完了しないので、必ず `--device-auth` を付ける。

root として SSH してしまうと auth ファイルが `/root` 配下に書かれて Volume に永続化されない可能性がある (`fly ssh console` がどのモードで shell を起動するかに依存する)。必ず `-u symphony` を付ける。

## 5. 再起動して通常動作モードへ

```bash
flyctl machine restart --app upflow-symphony
flyctl logs --app upflow-symphony
```

`[ready] listening on 0.0.0.0:8080` が出ていれば成功。auth 検出 → repo clone → pnpm install → HTTP server 起動、まで自動で進む。

## 6. tick エンドポイントの動作確認

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://upflow-symphony.fly.dev/tick
```

レスポンス例:

- `{"state":"idle"}` — `symphony:ready` の issue 無し
- `{"state":"busy", ...}` — 既に処理中 (concurrency=1)
- `{"state":"processed", "issue":N, "outcome":"success"}` — 1 件処理した

GitHub Actions cron が 15 分ごとにこれを叩く。idle 5 分 (`SYMPHONY_IDLE_SHUTDOWN_MS`) で machine 自己終了 → 次 tick で auto-start。

## 7. ステータス確認

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://upflow-symphony.fly.dev/status
```

machine が起きていれば現在の job 情報、寝ていれば auto-start 後に同情報が返る。

## メンテナンス

### 変更前にローカルで preflight 確認

`infra/symphony/**` (Dockerfile / fly.toml / entrypoint.sh / preflight-local.sh) を触ったら、push 前に手元で前処理が通るか確認する:

```bash
pnpm symphony:preflight:check
```

中身: `infra/symphony/preflight-local.sh` を `bash` で実行。symphony image をローカルでビルドし、その image 内で `pnpm install` → `pnpm db:setup` → `pnpm typecheck` の 3 段を、fly.toml と同じ環境変数を渡して走らせる。

これで「環境変数の漏れ」「image にバイナリが入ってない」「`pnpm db:setup` が壊れた」といった事故を `flyctl deploy` 前に検出できる (過去に #400 / #405 で同パターンで踏んだ)。

要件: docker (OrbStack 等)、git。所要時間: image 初回ビルド込みで 2-5 分、再実行は 1-2 分。

### コード更新の反映

`main` に push があれば、次の tick で entrypoint.sh が `git fetch && git reset --hard` で更新を pulldown する。`pnpm install` も毎回走るので依存変更も追従する。

Dockerfile / fly.toml / 各 CLI バイナリの変更は image rebuild が必要なので `flyctl deploy` を実行する:

```bash
flyctl deploy \
  --app upflow-symphony \
  -c infra/symphony/fly.toml \
  --dockerfile infra/symphony/Dockerfile
```

Volume の `/data` は image 再ビルドを跨いで保持される。auth state を失わない。

### CLI 群の更新

`infra/symphony/Dockerfile` 冒頭の ARG (`TAKT_VERSION` / `CLAUDE_CODE_VERSION` / `CODEX_VERSION` / `PNPM_VERSION` / `NODE_VERSION`) を新しいバージョンに書き換えて `flyctl deploy` する、を**唯一の更新フロー**にする:

```bash
# 1. infra/symphony/Dockerfile の ARG を編集
# 2. deploy
flyctl deploy \
  --app upflow-symphony \
  -c infra/symphony/fly.toml \
  --dockerfile infra/symphony/Dockerfile
```

`flyctl ssh console` で `npm update -g` などを直接叩くと image と実環境がドリフトして再現性が崩れるので**避ける**。cursor-agent は upstream 側にバージョン pin される配布物がまだないので、更新したい時は Dockerfile の `cursor-agent install` ブロックを更新 (or 完全に再ビルド) して deploy する。

### 認証の再取得 (token expire 時)

```bash
flyctl ssh console --app upflow-symphony
# 中で該当 CLI の login を再実行 (上記 §4 と同じ)
```

### machine が起きない

`flyctl logs --app upflow-symphony` でエラー確認。entrypoint.sh が `gh auth` 未設定を検知している場合は §4 を再実施。

### コスト確認

```bash
flyctl billing --app upflow-symphony
```

shared-cpu-1x + 1GB memory + 5GB volume を仮定して、1 日 1 時間程度の稼働なら月 $1 前後 (volume 固定 ~$0.75/月 + machine 稼働分)。

## 関連

- issue #370 (Symphony port 親 issue)
- [docs/symphony-setup-sprite.md](./symphony-setup-sprite.md) — 旧 sprites.dev 案 (deprecated、ナラティブ用に archive)
- [Fly machine docs](https://fly.io/docs/machines/)
- [Symphony SPEC.md (OpenAI)](https://github.com/openai/symphony/blob/main/SPEC.md)
