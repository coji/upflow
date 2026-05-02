# Structural tests

ソースコードの構造そのものに対して assert する Vitest テスト。AST を ts-morph で読み、ルール違反があれば落ちる。

## 何のためにあるか

- `arch-review` ペルソナや人手レビューが prose で見ている規約のうち、機械的に判定可能なものをここに移す
- ルール一覧は [`docs/rdd/issue-336-rule-inventory.md`](../../docs/rdd/issue-336-rule-inventory.md) のカテゴリ (a) machine-checkable
- `pnpm test` の一部として CI で回す。失敗したらマージ阻止

## ESLint や Biome ではなくここに書く理由

- upflow は Biome を使っており、ESLint と二重持ちにしたくない
- 単純なテキストパターンは regex / lefthook hook で済む。ここで扱うのは **AST 解析が必要なルール**
- dependency-cruiser で完結するもの（layer / `~/` import / `.server.ts` 隔離）はそちらに任せる
- それ以外、特に「kysely クエリの `WHERE organizationId` 必須」「action 内で `requireOrgMember` が `parseWithZod` より前」のような **制御フロー / 型情報を要するルール** がここの守備範囲

## 書き方の型

各テストは:

1. `Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true })` でローダーを最小化（高速化）
2. 走査対象ファイルを `addSourceFileAtPath` で 1 件ずつ追加
3. `forEachDescendant` で AST を走査して違反を集める
4. 最後に `expect(violations).toEqual([])`

サンプル: [`popover-fetcher-key.test.ts`](./popover-fetcher-key.test.ts)

## sanity check (synthetic violation)

各テストには「matcher 自体が壊れていないか」を確かめるため、**意図的に違反させた合成ソース**で違反を検知できることを確認する `it()` を 1 本含める。これがないと、AST 走査ロジックがバグで何も拾わなくなった場合、テストは常に green のまま誰も気づかない。

## 新しいルールを追加するときの流れ

1. inventory.md の (a) カテゴリから対象を 1 つ決める
2. `tests/structural/<rule-slug>.test.ts` を新規作成
3. テスト内に **どのルールか** をコメントで書く（出典 file:line を含める）
4. 走査対象ファイルを定数で列挙（無闇に `app/**/*` を全走査しない）
5. matcher を書く + sanity check も忘れずに
6. `pnpm vitest tests/structural/<rule-slug>.test.ts` で確認
7. inventory.md の該当行に「このルールは structural test で強制」と追記する PR を別途出す（or 同じ PR で）
