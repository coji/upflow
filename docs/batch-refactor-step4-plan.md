# Step 4: Export / Upsert の整理 - 作業計画

## 概要

Step 3 で整理した Provider 層の下流にある Export と Upsert の責務境界を整理する。

---

## 現状分析

### 1. Export 関数が 2 つに分散

**現状** (`batch/bizlogic/export-spreadsheet.ts`):

```typescript
// 2つの関数が同じパターンで実装されている
export const exportPullsToSpreadsheet = async (pullrequests, exportSetting) => {
  const sheet = createSheetApi({ ... })  // 共通
  const header = [...].join('\t')
  const data = [header, ...rows].join('\n')
  await sheet.paste(data)
}

export const exportReviewResponsesToSpreadsheet = async (reviewResponses, exportSetting) => {
  const sheet = createSheetApi({ ... })  // 共通
  const header = [...].join('\t')
  const data = [header, ...rows].join('\n')
  await sheet.paste(data)
}
```

**問題点**:

- `createSheetApi` の呼び出しが重複
- タブ区切りデータ生成のパターンが重複
- 呼び出し側 (`analyzeAndUpsert`) で 2 回呼び出している

### 2. upsertPullRequest に日付変換が混在

**現状** (`batch/db/mutations.ts`):

```typescript
export function upsertPullRequest(data: Insertable<DB.PullRequests>) {
  const firstCommittedAt = timeFormatUTC(data.firstCommittedAt)
  const pullRequestCreatedAt = timeFormatUTC(data.pullRequestCreatedAt)
  const firstReviewedAt = timeFormatUTC(data.firstReviewedAt)
  const mergedAt = timeFormatUTC(data.mergedAt)
  const releasedAt = timeFormatUTC(data.mergedAt) // ← バグ: data.releasedAt であるべき
  const updatedAt = timeFormatUTC(data.mergedAt) // ← バグ: data.updatedAt であるべき
  // ...
}
```

**問題点**:

- **バグ発見**: `releasedAt` と `updatedAt` が誤って `data.mergedAt` を参照
- 日付変換ロジックが DB 層に混在
- データ整形と DB I/O が分離されていない

---

## DB 保存形式の定義

- **日付カラム**: UTC 文字列 (`YYYY-MM-DD HH:mm:ss` 形式)
- `timeFormatUTC` で ISO 形式から DB 保存形式に変換
- この変換は DB 層の責務として維持する

---

## 作業内容（段階分け）

### Step 4-1: upsertPullRequest のバグ修正

**目的**: 明らかなバグを先に修正

**変更ファイル**: `batch/db/mutations.ts`

```typescript
// Before (バグ)
const releasedAt = timeFormatUTC(data.mergedAt)
const updatedAt = timeFormatUTC(data.mergedAt)

// After (修正)
const releasedAt = timeFormatUTC(data.releasedAt)
const updatedAt = timeFormatUTC(data.updatedAt)
```

**検証**: 型チェック → テスト → ゴールデン比較

**注意**: ゴールデン比較で差分が出る可能性あり（バグ修正のため）

#### 既存データの修正方針

バグにより DB に保存された誤った `releasedAt` / `updatedAt` への対応：

1. **本番環境**: バグ修正後、対象 organization に対して `upsert` コマンドを再実行する

   ```bash
   pnpm batch upsert --organization <org-id>
   ```

   これにより、正しい `releasedAt` / `updatedAt` で上書きされる

2. **影響範囲**:
   - `releasedAt`: リリース検出が正しく設定されている場合のみ影響
   - `updatedAt`: PR の最終更新日時が `mergedAt` と同じ値になっていた

3. **判断根拠**:
   - `upsert` は `onConflict` で既存行を更新するため、再実行で修正可能
   - 別途 migration script は不要

---

### Step 4-2: Export ファクトリの導入

**目的**: Export の重複コードを統合

**変更ファイル**: `batch/bizlogic/export-spreadsheet.ts`

```typescript
/** Exporter ファクトリ */
export function createSpreadsheetExporter(exportSetting: Selectable<DB.ExportSettings>) {
  const tz = 'Asia/Tokyo'

  return {
    exportPulls: async (pullrequests: Selectable<DB.PullRequests>[]) => {
      // 既存の exportPullsToSpreadsheet のロジック
    },
    exportReviewResponses: async (reviewResponses: ReviewResponse[]) => {
      // 既存の exportReviewResponsesToSpreadsheet のロジック
    },
  }
}

// 後方互換のため既存関数も維持（内部でファクトリを使用）
export const exportPullsToSpreadsheet = async (...) => {
  const exporter = createSpreadsheetExporter(exportSetting)
  return exporter.exportPulls(pullrequests)
}
```

**後方互換性の保証**:

- 既存関数 `exportPullsToSpreadsheet` / `exportReviewResponsesToSpreadsheet` は署名・動作を完全維持
- 戻り値: `Promise<void>` を維持（変更なし）
- 例外: `sheet.paste()` の例外をそのまま伝播（変更なし）
- 内部実装のみファクトリ利用に変更

**検証**: 型チェック → テスト → ゴールデン比較

**テスト観点**: 既存関数の呼び出しパターンが変わらないことを確認

---

### Step 4-3: analyzeAndUpsert での Exporter 利用

**目的**: ユースケース層で Exporter ファクトリを活用

**変更ファイル**: `batch/usecases/analyze-and-upsert.ts`

```typescript
// Before
if (organization.exportSetting) {
  await exportPullsToSpreadsheet(pulls, organization.exportSetting)
  await exportReviewResponsesToSpreadsheet(
    reviewResponses,
    organization.exportSetting,
  )
}

// After
if (organization.exportSetting) {
  const exporter = createSpreadsheetExporter(organization.exportSetting)
  await exporter.exportPulls(pulls)
  await exporter.exportReviewResponses(reviewResponses)
}
```

**検証**: 型チェック → テスト → ゴールデン比較

---

### Step 4-4: 日付変換の整理（オプション）

**目的**: 日付変換ロジックを DB 層から分離

**検討事項**:

- `buildPullRequestRow` で既に日付は ISO 形式で生成されている
- `upsertPullRequest` での `timeFormatUTC` は DB 保存形式への変換
- 現状では DB 層での変換が適切

**判断**: 現状維持。DB 保存形式（UTC 文字列）への変換は DB 層の責務として残す。

---

## 検証方法（各段階で必須）

1. **型チェック**: `pnpm typecheck`
2. **既存テスト**: `pnpm test`
3. **ゴールデン比較**: `pnpm batch:golden:compare`

差分が出た場合は、その段階で原因を特定してから次に進む。

---

## 作業順序

### Step 4-1: upsertPullRequest のバグ修正

1. [ ] `batch/db/mutations.ts` の `releasedAt` と `updatedAt` を修正
2. [ ] 型チェック・テスト・ゴールデン比較
3. [ ] **差分確認**: バグ修正により出力が変わる可能性あり
4. [ ] コミット

### Step 4-2: Export ファクトリの導入

1. [ ] `createSpreadsheetExporter` ファクトリを追加
2. [ ] 既存関数を内部でファクトリ利用に変更（署名・動作は完全維持）
3. [ ] 型チェック・テスト・ゴールデン比較
4. [ ] コミット

### Step 4-3: analyzeAndUpsert での Exporter 利用

1. [ ] `analyzeAndUpsert` で Exporter ファクトリを使用
2. [ ] 型チェック・テスト・ゴールデン比較
3. [ ] コミット
