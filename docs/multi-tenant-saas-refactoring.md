# マルチテナント SaaS リファクタリング

## Context

upflow を react-router-saas をリファレンスにした本格的なマルチテナント SaaS に作り直す。現状は org ID がそのまま URL セグメントに使われ、メンバーシップチェックなし、org 管理が `/admin` 配下にある。これを slug ベースの URL、メンバーシップガード付き、org 管理は `/:orgSlug/settings/` 配下に移動する。

### ユーザー決定事項

- URL: `/:orgSlug/...` に完全移行。後方互換なし
- Admin: org 管理は `/:orgSlug/settings/` 配下に移動。`/admin` は superadmin 専用
- オンボーディング: 管理者が招待。org 無しユーザーは「招待待ち」画面を表示
- ID: nanoid ランダム ID + slug 分離（既存 ID → slug にコピー）

---

## Phase 1: DB スキーマ変更

**目標**: `organizations.slug` を NOT NULL UNIQUE にし、既存 ID を slug にコピー。新規 org は nanoid を PK に使用。

### 変更ファイル

| ファイル               | 変更内容                                                                          |
| ---------------------- | --------------------------------------------------------------------------------- |
| `db/schema.sql`        | `slug` を `NOT NULL` に変更、`UNIQUE INDEX` 追加                                  |
| `db/migrations/`       | Atlas で自動生成。事前に `UPDATE organizations SET slug = id WHERE slug IS NULL`  |
| `db/seed.ts`           | `id: nanoid()`, `slug: 'techtalk'` に変更。`members` レコード追加（owner ロール） |
| `app/services/type.ts` | `pnpm db:generate` で再生成（`slug: string \| null` → `string`）                  |

### 検証

```bash
pnpm db:apply && pnpm db:generate && pnpm typecheck
```

---

## Phase 2: Auth ヘルパー追加

**目標**: メンバーシップチェック関数と reserved slug を追加。

### 変更ファイル

| ファイル                                                  | 変更内容                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `app/libs/auth.server.ts`                                 | `requireOrgMember`, `requireOrgAdmin`, `getUserOrganizations`, `getFirstOrganization`, `isReservedSlug` を追加 |
| `app/routes/resources+/organization/functions/queries.ts` | `listUserOrganizations` を `members JOIN` に修正                                                               |

### 追加する関数

```ts
// requireOrgMember(request, orgSlug) → OrgContext
//   members JOIN organizations WHERE slug = orgSlug AND userId = session.userId
//   メンバーでなければ /no-org にリダイレクト

// requireOrgAdmin(request, orgSlug) → OrgContext
//   requireOrgMember + role が owner/admin でなければ /:orgSlug にリダイレクト

// getUserOrganizations(userId) → { id, name, slug, role }[]
//   members JOIN organizations WHERE userId

// getFirstOrganization(userId) → { id, slug } | null

// isReservedSlug(slug) → boolean
//   'admin', 'login', 'logout', 'api', 'resources', 'healthcheck', 'no-org' 等
```

### 検証

```bash
pnpm typecheck
```

---

## Phase 3: ルート構造変更（最大の変更）

**目標**: `_dashboard+/$organization/` → `$orgSlug/`、`admin+/$organization.*` の org 管理を `$orgSlug/settings/` に移動。

### ルート構造 Before → After

```text
Before:                                      After:
_dashboard+/                                 $orgSlug/
  _layout.tsx (requireUser のみ)               _layout.tsx (requireOrgMember)
  $organization/route.tsx                      _index/route.tsx (ダッシュボード)
  $organization._index/route.tsx               ongoing/route.tsx
  $organization.ongoing/route.tsx              settings/
                                                 _layout.tsx (requireOrgAdmin)
admin+/                                          _index/route.tsx (org設定)
  $organization._layout/                         members/route.tsx
  $organization.members/                         repositories.tsx (layout)
  $organization.repositories.*/                  repositories._index/
  $organization.settings/                        repositories.$repository.*/
    forms/*.action.server.ts                     repositories.add/

admin+/ (残す)                               admin+/ (superadmin専用に縮小)
  _layout.tsx (requireSuperAdmin)              _layout.tsx
  _index/ (org一覧)                            _index/ (org一覧 + slug表示)
  create/ (org作成)                            create/ (slug入力に変更)
```

### 変更対象ファイル一覧

**新規作成（移動元からコピー＋修正）:**

| 新規ファイル                                              | 移動元                                                | 主な変更                                                     |
| --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| `app/routes/$orgSlug/_layout.tsx`                         | `_dashboard+/_layout.tsx` + `$organization/route.tsx` | `requireOrgMember` でガード。org, user, organizations を返す |
| `app/routes/$orgSlug/_index/route.tsx`                    | `_dashboard+/$organization._index/route.tsx`          | `params.organization` → `params.orgSlug`、`requireOrgMember` |
| `app/routes/$orgSlug/ongoing/route.tsx`                   | `_dashboard+/$organization.ongoing/route.tsx`         | 同上                                                         |
| `app/routes/$orgSlug/settings/_layout.tsx`                | `admin+/$organization._layout/route.tsx`              | `requireOrgAdmin`、ナビリンクを `/:orgSlug/settings/*` に    |
| `app/routes/$orgSlug/settings/_index/route.tsx`           | `admin+/$organization.settings/route.tsx`             | org設定フォーム移動                                          |
| `app/routes/$orgSlug/settings/_index/forms/*`             | `admin+/$organization.settings/forms/*`               | action の params 修正                                        |
| `app/routes/$orgSlug/settings/_index/functions.server.ts` | `admin+/$organization.settings/functions.server.ts`   |                                                              |
| `app/routes/$orgSlug/settings/members/route.tsx`          | `admin+/$organization.members/route.tsx`              |                                                              |
| `app/routes/$orgSlug/settings/repositories*`              | `admin+/$organization.repositories*`                  | 全リポジトリ管理ルート                                       |

**修正:**

| ファイル                                                             | 変更内容                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `app/routes/_index.tsx`                                              | ルート `/` → ログイン済みなら `/:firstOrgSlug` へリダイレクト |
| `app/routes/admin+/_index/route.tsx`                                 | org管理リンク削除、slug 表示追加                              |
| `app/routes/admin+/create/route.tsx`                                 | `organizationId` → `organizationSlug` に schema 変更          |
| `app/routes/admin+/create/mutations.server.ts`                       | `id: nanoid()`, `slug: input` に変更、reserved slug チェック  |
| `app/components/AppHeader.tsx`                                       | org switcher が `/:orgSlug` にリンク                          |
| `app/routes/resources+/organization/hooks/useCurrentOrganization.ts` | pathname[1] を slug として返す。`/admin` prefix は除外        |
| `app/routes/resources+/organization/route.tsx`                       | slug ベースで現在 org を特定                                  |
| `api.admin.recalculate.$organization.ts`                             | 変更なし（内部 API、org ID で OK）                            |

**削除:**

| 削除ファイル                             | 理由                        |
| ---------------------------------------- | --------------------------- |
| `app/routes/_dashboard+/` 全体           | `$orgSlug/` に移行          |
| `app/routes/admin+/$organization.*` 全体 | `$orgSlug/settings/` に移行 |

### `params.organization` の修正箇所（10箇所）

- `api.admin.recalculate.$organization.ts` — そのまま（superadmin内部API）
- `admin+/$organization.settings/forms/*` (5ファイル) — `$orgSlug/settings/` に移動時に修正
- `admin+/$organization.repositories.add/route.tsx` (3箇所) — 同上
- `_dashboard+/$organization/route.tsx` (1箇所) — `$orgSlug/_layout.tsx` に移行時に修正

### 検証

```bash
pnpm typecheck && pnpm dev
# ブラウザで /:orgSlug, /:orgSlug/settings, /admin を確認
```

---

## Phase 4: ポストログインフロー

**目標**: ログイン後に最初の org にリダイレクト。org なしユーザーは「招待待ち」画面。

### 変更ファイル

| ファイル                         | 変更内容                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `app/routes/_auth+/login.tsx`    | loader: セッションあり → `getFirstOrganization` → `/:slug` or `/no-org`。action: `callbackURL` を `/auth/callback` に |
| `app/routes/_auth+/callback.tsx` | **新規**。OAuth コールバック後に first org → リダイレクト                                                             |
| `app/routes/no-org.tsx`          | **新規**。`requireUser` でガード。「招待をお待ちください」画面 + ログアウトボタン                                     |
| `app/routes/_index.tsx`          | セッションあり → first org リダイレクト。なし → `/login`                                                              |

### 検証

```bash
# org ありユーザーでログイン → /:orgSlug に遷移
# org なしユーザーでログイン → /no-org に遷移
# / にアクセス → 適切にリダイレクト
```

---

## Phase 5: クリーンアップ

**目標**: 削除漏れ、セキュリティ監査、テスト修正。

### チェックリスト

- [ ] `grep -r "params.organization" app/routes/` → 0件（api.admin.recalculate 以外）
- [ ] `grep -r "_dashboard+" app/` → 0件
- [ ] 全 org スコープの DB クエリが `requireOrgMember` の後に実行されていることを確認
- [ ] `pnpm validate` (typecheck + lint + format) クリーン
- [ ] `pnpm test` パス
- [ ] E2E テストの URL パターン更新

### batch/ への影響

- `batch/db.ts` は org ID で直接クエリ → **変更不要**（既存 ID は PK として残る）
- `batch/cli.ts` の `--org` フラグは org ID → **変更不要**

---

## 実装順序と依存関係

```text
Phase 1 (DB) ─→ Phase 2 (Auth) ─→ Phase 3 (Routes) ─→ Phase 4 (Login) ─→ Phase 5 (Cleanup)
   │                  │                   │
   │                  │                   └── href() の型安全性は新ルート定義後に解決
   │                  └── string literal で仮リダイレクト（Phase 3 前でもコンパイル可）
   └── slug NOT NULL 後に全クエリで slug が使える
```

各フェーズ完了ごとにコミット。Phase 3 が最も大きく、サブコミットに分けてもよい。
