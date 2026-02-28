# 認証・メンバー管理 設計書

## 1. プロダクトの前提

upflow は OSS の開発生産性ダッシュボード。GitHub の PR データを解析してサイクルタイムを可視化する。

- 認証は GitHub OAuth のみ
- ユーザー管理は `companyGithubUsers` テーブルの `isActive` フラグで制御
- 初回デプロイ時は最初のログインユーザーが super admin になる

## 2. テーブルの役割

| テーブル             | DB     | 役割                                                                  |
| -------------------- | ------ | --------------------------------------------------------------------- |
| `users`              | shared | better-auth が管理するユーザーアカウント                              |
| `members`            | shared | `users` と `organizations` の多対多リレーション（org メンバーシップ） |
| `companyGithubUsers` | tenant | GitHub login の許可リスト + PR author/reviewer との紐付けマスタ       |

- `companyGithubUsers` = 「この GitHub ユーザーは org に所属してよい」という**事前登録リスト**
- `members` = better-auth の**実際の org メンバーシップ**（ログイン時に自動作成）

batch が発見した GitHub ユーザーは `members` には入れられない（`users` レコードが必要で、それは GitHub OAuth ログインしないと作れない）。
だから `companyGithubUsers` がゲートとして先に存在し、ログイン時に `members` が自動作成される。

## 3. 設計方針

### GitHub オンリー + isActive による制御

| 層                         | 何をするか                   | どう制御するか                                                   |
| -------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| **認証（ログイン）**       | ユーザーを識別する           | GitHub OAuth のみ                                                |
| **認可（サイトアクセス）** | サイトへのログインを許可する | `companyGithubUsers` に `isActive=1` で登録されている login のみ |
| **認可（org アクセス）**   | org のデータを見せる         | `companyGithubUsers` がある org に自動メンバー追加               |

### isActive フラグ

| 値          | 意味                         | 登録元                                              |
| ----------- | ---------------------------- | --------------------------------------------------- |
| `0`（無効） | 登録されているがログイン不可 | batch による自動登録                                |
| `1`（有効） | ログイン可能                 | admin による手動追加、または admin がトグルで有効化 |

### なぜこの方式か

- upflow は GitHub の PR データを扱うツール → GitHub ログインが最も自然
- `companyGithubUsers` は元々 PR author と upflow ユーザーの紐付けテーブル → allowlist として再利用できる
- batch が PR author/reviewer を自動登録 → admin は有効化するだけ
- メールアドレスに依存しない（GitHub login で照合）

## 4. フロー

### 初回セットアップ（本番デプロイ）

```
1. デプロイ + db:apply でマイグレーション適用
2. 最初のユーザーが /login → 「GitHub でログイン」
3. users テーブルが空なので allowlist チェックをスキップ → ログイン許可
4. user.create.after フックで users が1人だけ → super admin に昇格
5. super admin が /admin から org を作成
6. org の GitHub Users 設定画面で GitHub login を管理
```

### batch によるユーザー自動登録

```
1. batch が PR データを解析
2. PR author / reviewer / requested reviewer の login を収集
3. companyGithubUsers に INSERT ... ON CONFLICT DO NOTHING
   → isActive: 0（無効）、displayName: login（仮名）
4. admin が GitHub Users 設定画面で Active トグルを有効化
5. そのユーザーがログイン可能になる
```

### 新メンバーのログイン

```
1. admin が GitHub Users 設定画面で Active トグルを有効化（または手動追加）
2. そのユーザーに /login の URL を伝える
3. ユーザーが /login → 「GitHub でログイン」
4. getUserInfo で全 org の companyGithubUsers をチェック
   → isActive=1 で登録済み → ログイン許可
   → 未登録 or isActive=0 → ログイン拒否（エラーメッセージ表示）
5. ログイン後、companyGithubUsers にいる org に自動的にメンバー追加
6. ダッシュボードへリダイレクト
```

### メンバー無効化

```
1. admin が GitHub Users 設定画面で Active トグルを無効化
2. そのユーザーの全セッションが即時削除される（shared DB の sessions テーブルから DELETE）
3. そのユーザーは次回ログイン時に getUserInfo チェックで拒否される
```

## 5. 自動メンバー追加の仕組み

GitHub ログイン成功後の session hook で以下を行う:

1. GitHub API `/user` から `profile.login` を取得
2. 全 org の `companyGithubUsers` を検索（`isActive=1` のもの）
3. **所属していない org** で `companyGithubUsers` に `login` が登録されている場合 → `members` に自動追加
4. `companyGithubUsers.userId` を自動設定（PR author との紐付け）

これにより、admin が Active を有効化するだけで:

- ログイン許可
- org メンバー追加
- PR author 紐付け

の3つが自動的に解決する。

## 6. GitHub Users 設定画面

- **手動追加フォーム**: GitHub login を入力して追加（`isActive=1` で作成）
- **Active トグル**: Switch で有効/無効を切り替え（optimistic UI）
- **一覧表示**: login, display name, name, email, active, created
- **編集・削除**: ドロップダウンメニューから

## 7. 将来の拡張

| 項目               | 現在                          | 将来                            |
| ------------------ | ----------------------------- | ------------------------------- |
| ログインプロバイダ | GitHub のみ                   | GitHub + Google（再追加）       |
| サイトアクセス制御 | companyGithubUsers allowlist  | 制限なし（誰でもログイン可）    |
| org 参加           | companyGithubUsers 登録で自動 | 招待リンク + セルフサインアップ |
| org 作成           | super admin のみ              | ユーザーが自分で作成可          |
| セッション無効化   | Active 無効化時に即時無効化   | —                               |

## 8. 必要な環境変数

| 変数                                        | 用途                 | ステータス    |
| ------------------------------------------- | -------------------- | ------------- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth         | 必須          |
| `BETTER_AUTH_URL` / `SESSION_SECRET`        | Better Auth          | 必須          |
| `DATABASE_URL`                              | SQLite               | 必須          |
| `INTEGRATION_PRIVATE_TOKEN`                 | GitHub API（バッチ） | 必須→将来廃止 |
