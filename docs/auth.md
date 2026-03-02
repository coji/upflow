# Auth And Membership

認証・メンバー管理の現在の設計方針。

## 現在の前提

- 認証は GitHub ログインのみ
- サイトへのログイン可否は tenant DB の `companyGithubUsers.isActive` で制御する
- 初回ユーザーは bootstrap で super admin になる

## 役割分担

| テーブル             | DB     | 役割                                     |
| -------------------- | ------ | ---------------------------------------- |
| `users`              | shared | upflow のユーザーアカウント              |
| `members`            | shared | org メンバーシップ                       |
| `companyGithubUsers` | tenant | GitHub login の allowlist と紐付けマスタ |

要点:

- `companyGithubUsers` は「その org に入ってよい GitHub ユーザー」の事前登録リスト
- `members` は実際にログインした upflow ユーザーの所属
- batch が見つけた GitHub login はまず `companyGithubUsers` に入る

## 現在のフロー

1. batch が PR author / reviewer / requested reviewer を見つける
2. `companyGithubUsers` に inactive で自動登録する
3. admin が Active を有効化する
4. ユーザーが GitHub ログインする
5. ログイン成功後、該当 org に `members` を自動作成する
6. 同時に `companyGithubUsers.userId` を紐付ける

## 近い将来にやること

認証系は全部を広げず、まず GitHub App まわりだけ前に進める。

### 1. GitHub App 化

- OAuth App 前提をやめ、GitHub App を主軸にする
- user login と installation token ベースのデータ取得を寄せる
- private token 依存を減らす

### 2. Webhook のための install 管理

- installation ID と organization の対応を持つ
- install 状態を設定画面から見えるようにする
- リポジトリ自動登録の入口を作る

## 後回しにするもの

次は今すぐ広げない。

- 招待メールの本格化
- GitHub 以外のログインプロバイダ
- セルフサインアップ
- org 作成権限の開放

必要な理由が出たら再度切り出す。
