# 認証・招待・GitHub ID 紐付け 設計書

## 1. 設計方針

GitHub login と upflow ユーザーの紐付けは、**複数の経路で自動解決** する。ユーザーに手動操作を求めない。

| 紐付け経路                 | 自動/手動 | タイミング                                             |
| -------------------------- | --------- | ------------------------------------------------------ |
| GitHub ログイン            | 自動      | ログイン時に `account_id` (= GitHub username) から解決 |
| 招待時に GitHub login 指定 | 自動      | 招待 accept 時に紐付け                                 |
| 管理者が設定画面で紐付け   | 手動      | フォールバック                                         |

推奨パスは **GitHub ログイン**。upflow は GitHub の PR データを扱うツールなので、GitHub でログインするのが最も自然で、紐付けも即座に完了する。

## 2. GitHub ログインの追加

Better Auth に GitHub OAuth プロバイダーを追加する。

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

必要な OAuth スコープ: `read:user` のみ。リポジトリアクセス権限は不要（PR データの取得は既存のバッチ処理が担う）。

## 3. ログインと自動紐付け

### GitHub ログイン（推奨）

1. ログイン画面で「GitHub でログイン」を選択
2. Better Auth が `accounts` テーブルに `provider_id = 'github'`, `account_id = <GitHub username>` を保存
3. ログイン完了時のフックで、ユーザーが所属する全組織の `company_github_users` テーブルを検索
4. `login = account_id` のレコードが見つかれば `user_id` を自動設定

```typescript
// ログイン後の自動紐付け（auth hook）
const githubAccount = await db
  .selectFrom('accounts')
  .select('accountId')
  .where('userId', '=', user.id)
  .where('providerId', '=', 'github')
  .executeTakeFirst()

if (githubAccount) {
  await db
    .updateTable('companyGithubUsers')
    .set({ userId: user.id })
    .where('login', '=', githubAccount.accountId)
    .where('userId', 'is', null)
    .execute()
}
```

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

## 7. 必要な環境変数

| 変数                                        | 用途                | 新規 |
| ------------------------------------------- | ------------------- | ---- |
| `GITHUB_CLIENT_ID`                          | GitHub OAuth App    | 新規 |
| `GITHUB_CLIENT_SECRET`                      | GitHub OAuth App    | 新規 |
| `RESEND_API_KEY`                            | 招待メール送信      | 新規 |
| `DATABASE_URL`                              | SQLite              | 既存 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth        | 既存 |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`    | Better Auth         | 既存 |
| `INTEGRATION_PRIVATE_TOKEN`                 | GitHub API (バッチ) | 既存 |

GitHub OAuth App は `read:user` スコープのみ。Organization 単位ではなく個人の OAuth App で十分。

## 8. 実装ステップ

### 8a. GitHub OAuth + 自動紐付け

1. Better Auth に GitHub OAuth プロバイダーを追加
2. ログイン画面に「GitHub でログイン」ボタンを追加
3. GitHub ログイン時の `company_github_users.user_id` 自動紐付けフック

### 8b. 招待フロー

4. Atlas マイグレーション: `invitations` に `github_login` カラム追加
5. Resend をメールトランスポートとして設定（Better Auth の `sendInvitationEmail` フック）
6. メンバー招待画面に email + GitHub login 入力
7. 招待 accept 時の `company_github_users.user_id` 自動設定ロジック

### 8c. 連携 UI + 手動紐付け

8. 設定画面に GitHub アカウント連携 UI（Google ログインユーザー向け）
9. GitHub Users 設定画面に upflow ユーザー手動紐付け UI（フォールバック）
