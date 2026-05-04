# Symphony — Fly machine setup runbook

issue #370 で設計した Symphony port の実行基盤を Fly.io 上の単発 VM (Fly machine) に構築する。GitHub Actions の cron が 15 分おきに HTTP endpoint `/tick` を叩いて machine を起こし、machine は `symphony:ready` ラベルが付いた issue を 1 件 takt で消化する。なにも処理しない状態が 5 分続けば machine は自己終了し、Fly volume の固定課金だけが残る。

用語の対応:

- **Fly machine** — Fly.io が提供する単発 VM。`flyctl machine` 系で操作する
- **`/tick`** — Fly machine 内 HTTP server (port 8080) が公開するエントリポイント。`POST /tick` で 1 サイクル処理 + return
- **`symphony:ready` ラベル** — GitHub issue に付けると Symphony が拾って takt にかけてよいという意思表示

過去に sprites.dev で同じことを試みた記録は [docs/symphony-setup-sprite.md](./symphony-setup-sprite.md) に残してある (sprites の hibernation 仕様で D2 案が成立しなかった経緯)。

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
flyctl ssh console --app upflow-symphony
# 以下、container 内
mkdir -p /data/home && export HOME=/data/home

gh auth login                        # GitHub device flow
claude auth login --claudeai          # Claude Max
codex login                           # Codex Plus
cursor-agent login                    # Cursor Pro

# 全部成功してることを確認
gh auth status
claude auth status
ls /data/home/.codex/auth.json /data/home/.config/cursor/auth.json
exit
```

token はすべて Volume (`/data/home`) 配下に書かれる。machine restart や image rebuild を跨いで永続化する。

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
