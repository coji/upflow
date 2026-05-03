# issue-363: ログイン前提の e2e 基盤（テスト専用ログイン route + Playwright storageState）

## 背景・課題

GitHub OAuth のみの認証では、Playwright から org 配下の画面を安定してテストしづらい。seed 済みユーザーでセッションを再現する仕組みが必要。

## 設計判断（結論）

**案 A（採用）**: `NODE_ENV !== 'production'` と `ENABLE_E2E_LOGIN === '1'` の二重ガード付きで、開発・ローカル e2e 専用の `GET /test-login` resource route を用意し、better-auth のセッション作成処理で cookie を返したうえで `/` へ redirect する。Playwright はその URL を一度叩いて `storageState` を保存する。

**案 B（不採用）**: sessions テーブルへ直接 INSERT し、手作りで cookie を注入する。  
**理由**: better-auth のセッション cookie 名・署名形式・付随 cookie（例: session cache）に実装が密結合し、better-auth のバージョンアップで壊れやすい。

**案 C（不採用）**: GitHub OAuth フローを Playwright 側でモックする。  
**理由**: better-auth が OAuth state を署名検証するため、ブラウザ完結の「本物そっくり」モックは組み立てコストが高い。

### セッション作成 API

better-auth の `auth.api` には「既存ユーザーを指定して cookie 付きセッションだけ作る」公開メソッドがない。本実装では **`auth.$context` の `internalAdapter.createSession`** を使い、通常の sign-in と同じ DB 書き込み・フック経路でセッション行を作成する。Set-Cookie の値の署名には better-auth と同じ `makeSignature`（HMAC）を用いる。

## 二重 env ガードと運用

- **`ENABLE_E2E_LOGIN=1` 単体では有効化されない**: `NODE_ENV === 'production'` のときは常に 404（cookie を作らない）。
- **本番・Docker イメージ・デプロイ workflow には絶対に載せない**: 有効化すると他人が `GET /test-login?email=admin@example.com` でセッション取得できる（認証バイパスになり得る）。
- **参照箇所の抑制**: Vitest 構造テスト（`tests/structural/test-login-guard.test.ts`）で、許可リスト外のファイルに `ENABLE_E2E_LOGIN` が出現しないことを検査する。

## メール受け入れ

初回スコープでは **`admin@example.com` のみ**。未指定・未知のメール・`member@example.com` は 404 としセッションを作らない（後続で member 用 storageState を足す余地を残す）。

## アプリケーション変更（要約）

- `app/routes/_auth/test-login.ts` — 上記ガードと loader のみ（UI なし）
- Playwright: `auth.setup` プロジェクトで storageState 生成、本番テストはその state を利用
- `package.json` の `start:e2e` — `NODE_ENV=test`・`ENABLE_E2E_LOGIN=1`・`PORT=8811`・`BETTER_AUTH_URL=http://localhost:8811`（cookie / origin 整合）。`react-router-serve` は **`@react-router/serve` 依存**（本番 `pnpm start` が参照するバイナリ用；従来 lock に無く `pnpm start` も実行できるようにした）

## スキーマ変更

なし。

## 受け入れ条件

- `pnpm db:setup` 後、`pnpm test:e2e` でダッシュボード smoke が通る
- `pnpm validate` が通る
- Dockerfile / `.github/workflows/deploy.yml` に `ENABLE_E2E_LOGIN` が含まれない

## Status

実装中（issue #363）
