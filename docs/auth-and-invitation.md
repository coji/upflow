# 認証・メンバー管理 設計書

## 1. プロダクトのフェーズと前提

upflow は現在 **クローズドβ** フェーズ。運営者（super admin）が直接コンサルとして支援する開発チームに提供している。

- ユーザーは運営者が知っている人のみ
- org 作成は super admin が行う
- メンバー追加は **admin が GitHub login を登録** する方式
- 将来的にオープン化する可能性はあるが、今は考えない

## 2. 設計方針

### GitHub オンリー + admin による GitHub アカウント登録

| 層                         | 何をするか                   | どう制御するか                                          |
| -------------------------- | ---------------------------- | ------------------------------------------------------- |
| **認証（ログイン）**       | ユーザーを識別する           | GitHub OAuth のみ                                       |
| **認可（サイトアクセス）** | サイトへのログインを許可する | `companyGithubUsers` に登録されている GitHub login のみ |
| **認可（org アクセス）**   | org のデータを見せる         | `companyGithubUsers` がある org に自動メンバー追加      |

**`companyGithubUsers` テーブルが allowlist と org 所属を兼ねる。**

### なぜこの方式か

- upflow は GitHub の PR データを扱うツール → GitHub ログインが最も自然
- `companyGithubUsers` は元々 PR author と upflow ユーザーの紐付けテーブル → allowlist として再利用できる
- admin が GitHub login を登録する UI を追加するだけで招待フローが完成する
- メールアドレスに依存しない（GitHub login で照合）
- Google OAuth を削除することで認証フローがシンプルになる

## 3. フロー

### 新メンバー追加

```
1. admin が org の GitHub Users 設定画面で GitHub login を登録（例: "coji"）
2. そのユーザーに /login のURLを伝える（Slack、口頭など）
3. ユーザーが /login → 「GitHub でログイン」
4. getUserInfo で全 org の companyGithubUsers をチェック
   → 登録済み → ログイン許可
   → 未登録 → ログイン拒否（エラーメッセージ表示）
5. ログイン後、companyGithubUsers にいる org に自動的にメンバー追加
6. ダッシュボードへリダイレクト
```

### リピートログイン

```
1. /login → 「GitHub でログイン」
2. getUserInfo チェック → 許可（既に登録済み）
3. 既に org メンバーなのでそのままダッシュボードへ
```

### メンバー削除

```
1. admin が GitHub Users 設定画面で GitHub login を削除
2. そのユーザーは次回ログイン時に getUserInfo チェックで拒否される
3. 既存セッションは有効期限まで有効（即時無効化は将来検討）
```

## 4. 自動メンバー追加の仕組み

GitHub ログイン成功後の session hook で以下を行う:

1. GitHub API `/user` から `profile.login` を取得
2. ユーザーが所属する org を `members` テーブルから取得
3. **所属していない org** で `companyGithubUsers` に `login` が登録されている場合 → `members` に自動追加
4. `companyGithubUsers.userId` を自動設定（PR author との紐付け）

これにより、admin が GitHub login を登録するだけで:

- ログイン許可
- org メンバー追加
- PR author 紐付け

の3つが自動的に解決する。

## 5. 既存機能への影響

### 削除するもの

- Google OAuth プロバイダ（`socialProviders.google`）
- ログイン画面の Google ボタン
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` 環境変数
- `trustedProviders` によるアカウントリンク設定（プロバイダが1つなので不要）

### 変更するもの

- ログイン画面 → GitHub ボタンのみ（last-provider beacon も不要に）
- `getUserInfo` → allowlist チェックはそのまま維持
- session hook → org 自動メンバー追加ロジックを追加

### 追加するもの

- GitHub Users 設定画面に手動追加フォーム（GitHub login 入力）
- org 自動メンバー追加ロジック（`github-linking.server.ts` を拡張）

## 6. GitHub Users 設定画面の変更

### 現状

- PR author から自動取得された GitHub ユーザーの一覧表示のみ
- 手動追加 UI なし

### 変更後

- **手動追加フォーム**: GitHub login を入力して追加
- 一覧表示（既存）
- 削除ボタン（既存 or 追加）

追加時に GitHub API で login の存在確認をするとベター（typo 防止）。

## 7. 将来のオープン化に向けて

| 項目               | クローズドβ（現在）           | オープン（将来）                |
| ------------------ | ----------------------------- | ------------------------------- |
| ログインプロバイダ | GitHub のみ                   | GitHub + Google（再追加）       |
| サイトアクセス制御 | companyGithubUsers allowlist  | 制限なし（誰でもログイン可）    |
| org 参加           | companyGithubUsers 登録で自動 | 招待リンク + セルフサインアップ |
| org 作成           | super admin のみ              | ユーザーが自分で作成可          |

## 8. 実装ステップ

### Phase 1: GitHub オンリー化 + 自動メンバー追加

1. Google OAuth 削除（auth.server.ts、login.tsx、環境変数）
2. ログイン画面を GitHub ボタンのみに簡略化
3. session hook に org 自動メンバー追加ロジックを追加
4. GitHub Users 設定画面に手動追加フォームを実装

### Phase 2: 運用改善（必要に応じて）

5. GitHub login 追加時に GitHub API で存在確認
6. メンバー削除時の即時セッション無効化
7. admin 向けのメンバー管理画面（org メンバー一覧 + role 変更）

### Phase 3: GitHub App によるデータ取得（将来）

8. GitHub App の installation token でバッチ処理
9. `INTEGRATION_PRIVATE_TOKEN` の廃止

## 9. 必要な環境変数

| 変数                                            | 用途                 | ステータス    |
| ----------------------------------------------- | -------------------- | ------------- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`     | GitHub OAuth         | 既存          |
| `BETTER_AUTH_URL` / `SESSION_SECRET`            | Better Auth          | 既存          |
| `DATABASE_URL`                                  | SQLite               | 既存          |
| `INTEGRATION_PRIVATE_TOKEN`                     | GitHub API（バッチ） | 既存→将来廃止 |
| ~~`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`~~ | ~~Google OAuth~~     | **削除**      |
