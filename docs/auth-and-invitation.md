# 認証・招待・GitHub ID 紐付け 設計書

## 1. 設計方針

GitHub login と upflow ユーザーの紐付けは、**複数の経路で自動解決** する。ユーザーに手動操作を求めない。

| 紐付け経路                 | 自動/手動 | タイミング                                                  |
| -------------------------- | --------- | ----------------------------------------------------------- |
| GitHub ログイン            | 自動      | ログイン時に GitHub API `/user` から取得した `login` で解決 |
| 招待時に GitHub login 指定 | 自動      | 招待 accept 時に紐付け                                      |
| 管理者が設定画面で紐付け   | 手動      | GitHub でログインしないメンバー向けのフォールバック         |

> **注意**: Better Auth の `accounts.account_id` には GitHub の **numeric ID** が保存される（username ではない）。`companyGithubUsers.login` との紐付けには、ログイン時に GitHub API のプロフィール情報から取得できる `login` フィールドを使う。

推奨パスは **GitHub ログイン**。upflow は GitHub の PR データを扱うツールなので、GitHub でログインするのが最も自然で、紐付けも即座に完了する。

## 2. GitHub App（OAuth App ではなく）

**GitHub App** を使う。理由：

| 観点                 | OAuth App                              | GitHub App（採用）                                |
| -------------------- | -------------------------------------- | ------------------------------------------------- |
| ユーザー認証         | ○                                      | ○                                                 |
| リポジトリアクセス   | ユーザーの全リポジトリ                 | fine-grained（Org admin が選択）                  |
| 顧客オンボーディング | 運営者が Org に招待される必要あり      | Org admin が App を install するだけ              |
| トークン管理         | 手動で fine-grained token を作成・管理 | installation token が自動発行・自動ローテーション |
| Rate limit           | 5,000/h（ユーザー）                    | 5,000/h（user）or 15,000/h（installation）        |
| Webhook              | なし                                   | あり（将来のリアルタイム更新に対応可能）          |

**GitHub App は2つの役割を兼ねる：**

1. **ユーザー認証（OAuth フロー）**: ログイン + GitHub username 取得
2. **データ取得（Installation token）**: 顧客 Org の private repo から PR データを取得（現在の `INTEGRATION_PRIVATE_TOKEN` を置き換え）

### GitHub App の作成

1. https://github.com/settings/apps → 「New GitHub App」
2. 設定：

| 項目                 | 値                                                      |
| -------------------- | ------------------------------------------------------- |
| App name             | `Upflow Dev` / `Upflow`（環境別）                       |
| Homepage URL         | アプリの URL                                            |
| Callback URL         | `{BASE_URL}/api/auth/callback/github`                   |
| Setup URL (optional) | `{BASE_URL}/github/setup`（install 後のリダイレクト先） |
| Webhook              | 初期は無効（将来有効化）                                |

3. Permissions：

| カテゴリ   | Permission      | Access    | 用途                           |
| ---------- | --------------- | --------- | ------------------------------ |
| Account    | Email addresses | Read-only | ユーザー認証時のメール取得     |
| Repository | Pull requests   | Read-only | PR データ取得                  |
| Repository | Contents        | Read-only | コミット・タグデータ取得       |
| Repository | Metadata        | Read-only | リポジトリ基本情報（自動付与） |

4. 「Where can this GitHub App be installed?」→ **Any account**（顧客の Org に install してもらうため）

### Better Auth への設定

```typescript
// auth.server.ts
socialProviders: {
  google: { ... },  // 既存
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
},
```

ユーザー認証には GitHub App の OAuth フローを使う。Better Auth の GitHub provider 設定は OAuth App と同じインターフェース。

## 3. ログインと自動紐付け

### GitHub ログイン（推奨）

1. ログイン画面で「GitHub でログイン」を選択
2. Better Auth が `accounts` テーブルに `provider_id = 'github'`, `account_id = <GitHub numeric ID>` を保存
3. Better Auth の GitHub provider は `getUserInfo` で GitHub API `/user` を呼び、レスポンスの `login`（= GitHub username）を取得できる
4. ログイン完了時のフックで、`login` を使ってユーザーが所属する全組織の `company_github_users` テーブルを検索
5. マッチするレコードが見つかれば `user_id` を自動設定

```typescript
// Better Auth の GitHub provider 設定で login を取得
socialProviders: {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    mapProfileToUser: (profile) => ({
      // profile.login = GitHub username (e.g. "octocat")
      // profile.id = GitHub numeric ID (e.g. "1234567")
      // users テーブルにカスタムカラムを追加するか、
      // フック内で profile.login を直接使う
    }),
  },
},

// ログイン後の自動紐付け（auth hook）
// Better Auth の getUserInfo が返す data に GithubProfile 全体が含まれる
// profile.login が GitHub username
const githubLogin = profile.login // GitHub username

if (githubLogin) {
  await db
    .updateTable('companyGithubUsers')
    .set({ userId: user.id })
    .where('login', '=', githubLogin)
    .where('userId', 'is', null)
    .execute()
}
```

> **実装上の注意**: `accounts.account_id` は GitHub の numeric ID であり、`companyGithubUsers.login`（GitHub username）とは一致しない。紐付けには auth フック内で GitHub API のプロフィール情報（`profile.login`）を使う必要がある。

### Google ログイン + 招待時紐付け

1. 管理者がメンバー招待画面で email + GitHub login を入力
2. Resend 経由で招待メールを送信
3. ユーザーが Google でログインし、招待を accept
4. accept 時に `invitation.github_login` → `company_github_users.user_id` を自動設定

### Google ログイン + 後から GitHub 連携

1. Google でログイン済みのユーザーが設定画面で「GitHub アカウントを連携」
2. Better Auth のアカウントリンク機能で GitHub プロバイダーを追加
3. 連携完了時に上記と同じ自動紐付けロジックが走る

## 4. DB の変更

`invitations` テーブルに GitHub login カラムを追加する。

```sql
ALTER TABLE invitations ADD COLUMN github_login TEXT;
```

## 5. 招待メール

Resend を使用してトランザクショナルメールを送信する。

```typescript
{
  from: 'noreply@upflow.example',
  to: invitation.email,
  subject: `${inviter.name} さんから ${org.name} への招待`,
  // 招待 accept リンク（Better Auth の invitation accept endpoint）
}
```

Better Auth の Organization plugin が提供する `sendInvitationEmail` フックに Resend をトランスポートとして設定する。

## 6. 管理者による手動紐付け（フォールバック）

GitHub Users 設定画面に「upflow ユーザーとの紐付け」セレクトボックスを追加し、`user_id` を設定できるようにする。自動紐付けが何らかの理由で機能しない場合の救済策。

## 7. データ取得の移行（Installation Token 化）

現在のバッチ処理は `INTEGRATION_PRIVATE_TOKEN`（運営者個人の fine-grained token）で GitHub API にアクセスしている。これを GitHub App の installation token に移行する。

### 移行の流れ

1. 顧客の Org admin が GitHub App を install（対象リポジトリを選択）
2. upflow が installation ID を DB に保存（`integrations` テーブルを拡張）
3. バッチ実行時に installation token を動的に生成して API アクセス

### Installation Token の生成

```typescript
import { createAppAuth } from '@octokit/auth-app'

const auth = createAppAuth({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
  installationId: installation.id,
})

const { token } = await auth({ type: 'installation' })
// この token でバッチの GraphQL クエリを実行
```

### 移行戦略

- **段階的移行**: `INTEGRATION_PRIVATE_TOKEN` と installation token を並行サポート
- `integrations` テーブルに `github_app_installation_id` がある場合は installation token を使用
- ない場合は従来の `INTEGRATION_PRIVATE_TOKEN` にフォールバック
- 全顧客の移行が完了したら `INTEGRATION_PRIVATE_TOKEN` を廃止

## 8. 必要な環境変数

| 変数                                        | 用途                                     | 新規/既存 |
| ------------------------------------------- | ---------------------------------------- | --------- |
| `GITHUB_APP_ID`                             | GitHub App ID                            | 新規      |
| `GITHUB_CLIENT_ID`                          | GitHub App OAuth（ログイン用）           | 新規      |
| `GITHUB_CLIENT_SECRET`                      | GitHub App OAuth（ログイン用）           | 新規      |
| `GITHUB_APP_PRIVATE_KEY`                    | GitHub App（installation token 生成）    | 新規      |
| `RESEND_API_KEY`                            | 招待メール送信                           | 新規      |
| `DATABASE_URL`                              | SQLite                                   | 既存      |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth                             | 既存      |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`    | Better Auth                              | 既存      |
| `INTEGRATION_PRIVATE_TOKEN`                 | GitHub API（移行期間中のフォールバック） | 既存→廃止 |

## 9. 実装ステップ

### 9a. GitHub App + ログイン + 自動紐付け

1. GitHub App を作成（開発用: `Upflow Dev`）
2. Better Auth に GitHub App の OAuth プロバイダーを追加
3. ログイン画面に「GitHub でログイン」ボタンを追加
4. GitHub ログイン時の `company_github_users.user_id` 自動紐付けフック

### 9b. Installation Token によるデータ取得

5. DB スキーマ: `integrations` テーブルに `github_app_installation_id` カラム追加
6. GitHub App install 時の installation ID 保存エンドポイント（Setup URL）
7. バッチ処理: installation token 生成 + 既存 token からのフォールバック
8. 管理画面: GitHub App install 状態の表示 + install リンク

### 9c. 招待フロー

9. Atlas マイグレーション: `invitations` に `github_login` カラム追加
10. Resend をメールトランスポートとして設定（Better Auth の `sendInvitationEmail` フック）
11. メンバー招待画面に email + GitHub login 入力
12. 招待 accept 時の `company_github_users.user_id` 自動設定ロジック

### 9d. 連携 UI + 手動紐付け

13. 設定画面に GitHub アカウント連携 UI（Google ログインユーザー向け）
14. GitHub Users 設定画面に upflow ユーザー手動紐付け UI（フォールバック）
