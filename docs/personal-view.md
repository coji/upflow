# 個人ビュー機能 設計書

## 1. 背景と目的

### 解決したい問題

upflow は現在、チーム全体のサイクルタイムを俯瞰するマネージャー向けダッシュボードとして機能している。利用頻度は週1〜月1程度にとどまり、エンジニアの日常に入り込めていない。

エンジニアが毎朝直面している問題は「PR が滞留していることを知らない」ではない。GitHub Notifications にも Slack にも通知は来ている。問題は「わかっていても後回しにする」こと、そして「複数の PR やレビュー依頼の中から、今やるべきことを選ぶ判断コストが高い」ことにある。

### 目的

エンジニアの「今日、最初に何をすべきか」という判断コストをゼロに近づける。upflow を「状態を見るダッシュボード」から「行動を決めるツール」に転換する。

### 設計原則

- **1つの問いに答える。** 「今日何をすべきか」。それ以外の情報は出さない
- **シンプルに。** 構造は1本のリスト。アクション可能なものを上に、待ちを下に。それ以上の分類はしない
- **示唆的に。** 行動を強制するのではなく、判断の材料を添える。最終的な優先順位はエンジニア自身が決める
- **短命な前提に依存しない。** 「人間が PR レビューする」ワークフローが変わっても、「チームの中で自分が今やるべきことがわかる」という価値は残る

---

## 2. 前提条件

| 項目                | 現状                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR データの粒度     | PR 基本情報 + レビューイベント（誰がいつ approve/request changes したか）                                                                         |
| 認証基盤            | Better Auth 導入済み（Google プロバイダー + Organization plugin）                                                                                 |
| GitHub ユーザー管理 | `company_github_users` テーブルで GitHub login を組織単位に管理。`user_id` カラム（nullable）で upflow ユーザーとの紐付けが可能だが、現在は未使用 |
| 初期ユーザー        | すでに upflow を導入中のチームが存在                                                                                                              |
| 技術スタック        | TypeScript, React Router v7, Vite, SQLite, Fly.io                                                                                                 |

---

## 3. ユーザーと利用シナリオ

### 対象ユーザー

既存の upflow 導入チームに所属するソフトウェアエンジニア。日常的に PR を作成しレビューする実務者。

### 利用シナリオ

**朝の確認（毎日、30秒）**

エンジニアが upflow を開く。「今日のアクション」リストに5件並んでいる。一番上は「@author1 の API 統一 PR をレビュー（推定10分、依頼から28時間経過）」。2番目は「自分のバリデーション修正 PR のフォローアップ（レビューコメント3件未対応、51時間経過）」。上から順にやればいい、と判断できる。30秒で画面を閉じる。

**日中のチェック（随時、10秒）**

PR を出した後、またはレビューを終えた後に、リストが減ったことを確認する。

---

## 4. 現状のデータモデルと必要な拡張

### 4.1 現状のデータフロー

```text
GitHub GraphQL API → batch fetch → shape → analyze → DB upsert
```

バッチ処理は以下のデータを **取得済み** だが、DB に保存しているのは一部のみ。

| データ                                         | API取得 | DB保存 | 備考                                                 |
| ---------------------------------------------- | ------- | ------ | ---------------------------------------------------- |
| PR 基本情報 (author, state, title, url, dates) | o       | o      | `pull_requests` テーブル                             |
| requested_reviewers (レビュー依頼先)           | o       | x      | shaper で `reviewers[]` に整形済みだが DB カラムなし |
| reviews (approve/changes_requested/commented)  | o       | x      | `first_reviewed_at` に集約され、個別 review は破棄   |
| review comments (レビューコメント)             | o       | x      | サイクルタイム計算後に破棄                           |
| additions / deletions (変更行数)               | x       | x      | GraphQL クエリに含まれていない                       |
| commits                                        | o       | x      | `first_committed_at` に集約                          |

### 4.2 個人ビューに必要なデータ

アクションリストの各判定に必要なデータと、その充足状況:

| 判定                                                   | 必要なデータ                                                     | 現状                           |
| ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------ |
| 「レビューする」(自分にレビュー依頼が来ている)         | requested_reviewers にログインユーザーの GitHub login が含まれる | **DB 保存が必要**              |
| 「コメントに対応する」(自分の PR に CHANGES_REQUESTED) | reviews の state が CHANGES_REQUESTED                            | **DB 保存が必要**              |
| 「マージする」(自分の PR が approve 済み)              | reviews の state が APPROVED (1つ以上)                           | **DB 保存が必要**              |
| 「レビュー待ち」(自分の PR、レビューまだ)              | PR author = 自分 AND first_reviewed_at IS NULL                   | **既存データで可能**           |
| 推定負荷                                               | additions + deletions                                            | **GraphQL クエリ拡張が必要**   |
| 経過時間の起算                                         | review_request 時刻、最後の review 時刻                          | **DB 保存が必要**              |
| ログインユーザー ↔ GitHub login の紐付け               | `company_github_users.user_id`                                   | **紐付けロジックの実装が必要** |

### 4.3 必要な DB スキーマ拡張

#### 新規テーブル: `pull_request_reviews`

個別のレビューイベントを保存する。

```sql
CREATE TABLE pull_request_reviews (
  id TEXT PRIMARY KEY,
  pull_request_number INTEGER NOT NULL,
  repository_id TEXT NOT NULL,
  reviewer TEXT NOT NULL,           -- GitHub login
  state TEXT NOT NULL,              -- APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED
  submitted_at TEXT NOT NULL,       -- ISO 8601
  url TEXT NOT NULL,
  FOREIGN KEY (pull_request_number, repository_id)
    REFERENCES pull_requests(number, repository_id) ON DELETE CASCADE,
  UNIQUE(pull_request_number, repository_id, reviewer, submitted_at)
);
```

> **注**: `pull_requests` の PK は `(number, repository_id)` の複合キーであり、FK はこれを参照する。

#### 新規テーブル: `pull_request_reviewers`

現在のレビュー依頼状態を保存する。

```sql
CREATE TABLE pull_request_reviewers (
  pull_request_number INTEGER NOT NULL,
  repository_id TEXT NOT NULL,
  reviewer TEXT NOT NULL,           -- GitHub login
  requested_at TEXT,                -- ISO 8601 (取得可能な場合)
  PRIMARY KEY (pull_request_number, repository_id, reviewer),
  FOREIGN KEY (pull_request_number, repository_id)
    REFERENCES pull_requests(number, repository_id) ON DELETE CASCADE
);
```

#### `pull_requests` テーブルへのカラム追加

```sql
ALTER TABLE pull_requests ADD COLUMN additions INTEGER;
ALTER TABLE pull_requests ADD COLUMN deletions INTEGER;
ALTER TABLE pull_requests ADD COLUMN changed_files INTEGER;
```

### 4.4 バッチ処理の拡張

#### GraphQL クエリの変更

PR フィールドに `additions`, `deletions`, `changedFiles` を追加:

```graphql
pullRequests {
  additions
  deletions
  changedFiles
  # ... 既存フィールド
}
```

#### upsert パイプラインの変更

1. `pull_requests` に `additions`, `deletions`, `changed_files` を書き込む
2. `pull_request_reviews` に個別レビューを upsert する（現在は集約後に破棄しているデータを保存）
3. `pull_request_reviewers` にレビュー依頼状態を upsert する（現在は shaper の `reviewers[]` を保存）

バッチ処理は既にこれらのデータを取得・整形しているため、**DB 書き込みの追加のみ** で対応可能。

---

## 5. GitHub ID 紐付け

個人ビューでは、ログインユーザーの GitHub login（`$me`）を特定してクエリに使う。紐付けの仕組み全体は [認証・招待・GitHub ID 紐付け 設計書](./auth-and-invitation.md) を参照。

### `$me` の解決

```typescript
// company_github_users.user_id で解決
const githubUser = await db
  .selectFrom('companyGithubUsers')
  .select('login')
  .where('userId', '=', session.user.id)
  .where('organizationId', '=', organization.id)
  .executeTakeFirst()

if (githubUser) {
  return githubUser.login // → アクションリストのクエリに使用
}

// 未紐付け → ガイダンス画面
```

### 未紐付け時のガイダンス

`company_github_users.user_id` が未設定のユーザーが個人ビューにアクセスした場合:

- GitHub アカウント未連携の場合: 「GitHub でログイン」ボタンを表示（連携すれば即解決）
- GitHub 連携済みだが `company_github_users` にマッチしない場合: 「組織の管理者に GitHub ユーザーの登録を依頼してください」と表示

---

## 6. アクションリスト

### 6.1 構成

個人ビューの画面はアクション可能なものと待ちの2グループで構成する:

1. **今日のアクション**: 自分がボトルネックになっている PR（上から順にやれば合理的）
2. **待ち**: 自分にできることがない PR（参考情報）

「自分の PR」と「レビュー依頼」を区別せず、「自分がアクションを取るべきもの」として統合する。全体として1本のリストであり、アクション可能かどうかで上下に配置が分かれるだけ。

### 6.2 アイテムの分類ロジック

ログインユーザーの GitHub login を `$me` とする。

| アクション         | 条件                                                                                                              | グループ         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------- |
| レビューする       | `pull_request_reviewers` に `$me` が存在 AND `pull_request_reviews` に `$me` の APPROVED/CHANGES_REQUESTED がない | 今日のアクション |
| コメントに対応する | `author = $me` AND 最新の review が `CHANGES_REQUESTED`                                                           | 今日のアクション |
| マージする         | `author = $me` AND `APPROVED` が1つ以上 AND `state = 'open'`                                                      | 今日のアクション |
| レビュー待ち       | `author = $me` AND `state = 'open'` AND 上記いずれにも該当しない                                                  | 待ち             |

判定の優先順位: マージする > コメントに対応する > レビューする > レビュー待ち

**初期実装での割り切り:**

- 「未対応コメント」は個別コメントの resolved 状態ではなく、**最新の review state が `CHANGES_REQUESTED` であるか**で判定する
- 「マージ可能」は CI ステータスや required reviewers 数は見ず、**APPROVED が1つ以上あるか**のみで判定する
- force push 後の re-review 要求: GitHub の設定により `requested_reviewers` に再登場するかはリポジトリ依存。初期実装では `requested_reviewers` のスナップショットをそのまま信頼し、re-review の検出は行わない
- これらは後のフェーズで精緻化可能

### 6.3 各アイテムの表示項目

- アクション種別（「レビューする」「コメントに対応する」「マージする」「レビュー待ち」）
- PR タイトル（GitHub へのリンク付き）
- 相手（レビュー依頼なら作成者、自分の PR なら最新レビュアー）
- 経過時間
- 推定負荷（取得できる場合）
- 滞留度の色表示

### 6.4 推定負荷

変更行数（additions + deletions）から算出:

| 変更行数 | 表示           |
| -------- | -------------- |
| 〜50行   | 軽い（5分）    |
| 〜200行  | 中程度（15分） |
| 200行超  | 重い（30分+）  |

`additions` / `deletions` が NULL の場合（バッチ拡張前の既存データ）は推定負荷を省略する。

### 6.5 経過時間の起算点

| アクション         | 起算点                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| レビューする       | `pull_request_reviewers.requested_at`、NULL の場合は `pull_requests.pull_request_created_at` |
| コメントに対応する | 最新の `CHANGES_REQUESTED` review の `submitted_at`                                          |
| マージする         | 最新の `APPROVED` review の `submitted_at`                                                   |
| レビュー待ち       | `pull_request_created_at`                                                                    |

経過時間は暦日（カレンダー時間）で計算する。営業時間オプションは将来の検討事項。

### 6.6 並び順（スコアリング）

リストの並び順は「上から順にやれば合理的」になるよう決定する。

**今日のアクション内の並び順:**

1. 経過時間が長いものを上に（チーム全体のフロー効率を優先）
2. 同程度の経過時間なら、推定負荷が軽いものを上に（軽いものから片付けてスループット向上）

> **設計判断**: 当初「推定負荷が軽い順」を第一ソートにする案があったが、28時間放置の重い PR を16時間放置の中程度の PR より後回しにするのは直感に反する。経過時間を第一優先とし、推定負荷はタイブレーカーとする。

**待ちグループ:**

- 経過時間が長いものを上に

### 6.7 滞留度の色表示

各アイテムに経過時間に応じた色を表示する。独立したアラート領域は設けない。

| 状態       | レビュー依頼 | その他   |
| ---------- | ------------ | -------- |
| 正常       | —            | —        |
| 警告（黄） | 12時間超     | 24時間超 |
| 危険（赤） | 24時間超     | 48時間超 |

閾値は固定値。将来的にチーム設定で変更可能にする。

---

## 7. データ更新

- 画面表示時に upflow が保持している最新データを表示する（既存バッチの取得サイクルに依存）
- 画面上に最終データ更新時刻を表示する
- 手動リロードボタンを設置する

---

## 8. 画面構成

### 8.1 個人ビュー

既存のサイドバーレイアウト内のコンテンツ領域に表示する。

```text
┌────────────┬──────────────────────────────────────┐
│ Sidebar    │                                      │
│            │  今日のアクション              4件    │
│ Analytics  │                                      │
│  Dashboard │  ┌──────────────────────────────────┐│
│  Ongoing   │  │ コメントに対応する          🔴  ││
│            │  │ fix: ログイン画面のバリデーション ││
│ ★ My      │  │ @reviewer1 から 3件 · 51時間前   ││
│  Actions   │  ├──────────────────────────────────┤│
│            │  │ レビューする                🔴  ││
│ Management │  │ refactor: APIレスポンス統一  重い ││
│  (admin)   │  │ by @author1 · 28時間前           ││
│            │  ├──────────────────────────────────┤│
│            │  │ レビューする                🟡  ││
│ ────────── │  │ chore: CI設定の更新       中程度 ││
│ User Menu  │  │ by @author2 · 16時間前           ││
│            │  ├──────────────────────────────────┤│
│            │  │ レビューする                     ││
│            │  │ docs: README更新            軽い ││
│            │  │ by @author3 · 2時間前            ││
│            │  └──────────────────────────────────┘│
│            │                                      │
│            │  待ち                          1件    │
│            │  ┌──────────────────────────────────┐│
│            │  │ レビュー待ち                🟡  ││
│            │  │ feat: ユーザー設定ページ追加     ││
│            │  │ → @reviewer2 未レビュー·26時間前 ││
│            │  └──────────────────────────────────┘│
│            │                                      │
│            │  最終更新: 15分前            更新 ↻   │
└────────────┴──────────────────────────────────────┘
```

- 「今日のアクション」と「待ち」の2グループ（1本のリストの上下配置）
- 各アイテムの先頭にアクション動詞を置く
- 経過時間順（長い順）で並ぶ。51時間 → 28時間 → 16時間 → 2時間
- 推定負荷は右端に参考表示

### 8.2 サイドバーナビゲーション

サイドバーの表示はユーザーのロールによって変わる:

| セクション                                           | owner / admin | member     |
| ---------------------------------------------------- | ------------- | ---------- |
| Analytics（Dashboard, Ongoing）                      | 表示          | 表示       |
| My Actions（個人ビュー）                             | 表示          | 表示       |
| Management（Members, Repos, GitHub Users, Settings） | 表示          | **非表示** |

member ロールのユーザーには Management セクション自体を表示しない。見えるのに使えないリンクは混乱の元。

---

## 9. 非機能要件

| 項目           | 要件                                                                                 |
| -------------- | ------------------------------------------------------------------------------------ |
| ページ読み込み | 2秒以内（データ取得含む）                                                            |
| 対象PR数       | 100件程度でも問題なく表示                                                            |
| セキュリティ   | 既存の組織単位アクセス制御を踏襲。同一組織のメンバーは他メンバーの PR 情報を閲覧可能 |

---

## 10. スコープ外（初期リリースに含めないもの）

- Slack 通知（招待メールは Resend で対応）
- 閾値のチーム単位カスタマイズ
- PR サイズ判定による AI レビュー自動マージ
- モバイル専用 UI（レスポンシブ対応は行う）
- チームビュー（他メンバーのアクションリスト閲覧）
- CI ステータスの取得・表示
- required reviewers 数の考慮

---

## 11. 実装フェーズ

### Phase 1: 既存 UI の UX 改善

個人ビュー導入前に、現状の UI で管理者・開発者双方に引っかかりがある箇所を解消する。

1. **サイドバー Management グループのロール制御**: Management セクション（Members, Repositories, GitHub Users, Settings）を member ロールのユーザーには非表示にする。現状は全員に表示されており、クリックすると無言でダッシュボードにリダイレクトされるため混乱を招く
2. **`/no-org` ページにスーパーアドミン向け導線**: 初回セットアップ時、スーパーアドミンが組織を作成するには `/admin` を手動で URL 入力する必要がある。`/no-org` ページに `user.role === 'admin'` の場合のみ「組織を作成」リンクを表示する

### Phase 2: データ基盤整備

DB スキーマ拡張とバッチ処理の修正。個人ビューの前提となるデータを揃える。

1. Atlas マイグレーション: `pull_request_reviews`, `pull_request_reviewers` テーブル作成
2. Atlas マイグレーション: `pull_requests` に `additions`, `deletions`, `changed_files` カラム追加
3. GraphQL クエリに `additions`, `deletions`, `changedFiles` を追加
4. バッチ upsert に `pull_request_reviews`, `pull_request_reviewers` の書き込みを追加
5. バッチ upsert に `additions`, `deletions`, `changed_files` の書き込みを追加

### Phase 3: 認証・招待・紐付け基盤

詳細は [認証・招待・GitHub ID 紐付け 設計書](./auth-and-invitation.md) を参照。

#### 3a. GitHub OAuth + 自動紐付け

1. Better Auth に GitHub OAuth プロバイダーを追加
2. ログイン画面に「GitHub でログイン」ボタンを追加
3. GitHub ログイン時の `company_github_users.user_id` 自動紐付けフック

#### 3b. 招待フロー

1. Atlas マイグレーション: `invitations` に `github_login` カラム追加
2. Resend をメールトランスポートとして設定（Better Auth の `sendInvitationEmail` フック）
3. メンバー招待画面に email + GitHub login 入力
4. 招待 accept 時の `company_github_users.user_id` 自動設定ロジック

#### 3c. 連携 UI + 手動紐付け

1. 設定画面に GitHub アカウント連携 UI（Google ログインユーザー向け）
2. GitHub Users 設定画面に upflow ユーザー手動紐付け UI（フォールバック）

### Phase 4: 個人ビュー（最小構成）

1. `/:orgSlug/me` ルートの作成
2. `$me` 解決ロジック（`company_github_users.user_id` → `login`）
3. アクションリストの loader 実装（クエリ）
4. アクションリスト UI の実装
5. サイドバーに個人ビューへのリンクを追加

### Phase 5: フィードバック収集と改善

- スコアリングの重み付け調整
- 推定負荷の精度検証
- 必要に応じて Slack 通知の検討

---

## 12. 検証計画

### 計測基盤

Google Analytics 4 (GA4) を導入する。主要イベント:

| イベント名      | トリガー                   | パラメータ                   |
| --------------- | -------------------------- | ---------------------------- |
| `page_view`     | ページ表示                 | `page_path`, `org_slug`      |
| `action_click`  | アクションリストのPRリンク | `action_type`, `elapsed_hrs` |
| `refresh_click` | 手動リロードボタン         | `items_count`                |

### 成功指標

| 指標                              | 目標            | 計測時期    | 計測手段                               |
| --------------------------------- | --------------- | ----------- | -------------------------------------- |
| 週5日以上アクセスするユーザー比率 | 50%以上         | 導入4週間後 | GA4 `page_view` の日別ユニークユーザー |
| 平均滞在時間                      | 1分以内         | 導入4週間後 | GA4 エンゲージメント時間               |
| レビュー待ち時間の中央値          | 導入前比20%短縮 | 導入8週間後 | upflow 既存のサイクルタイムデータ      |

### フィードバック確認項目

- エンジニアが朝開いて30秒で閉じているか（短いほど良い）
- 「上から順にやる」という行動が自然に起きているか
- 推定負荷の精度は実感と合っているか
- スコアリングの結果に違和感がないか
