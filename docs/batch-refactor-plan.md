# Batch ロジック高凝集リファクタリング計画（Martin Fowler 流 + 関数型ドメインモデリング）

## 目的
- `batch/` の責務の分散を抑え、**取得(fetch) → 解析(analyze) → 永続化(upsert) → 出力(export)** を明確な凝集単位に再編成する。
- 解析ロジックを**関数型ドメインモデル**で表現し、ドメイン計算は純粋関数として分離する。
- 既存の分析結果（PR の時系列・サイクルタイム算出・レビュー反応時間など）に**影響を与えない**ことを最優先にする。

## 現状の観察（要点）
- `batch/jobs/crawl.ts` と `batch/commands/upsert.ts` が**同じ処理フロー**を二重に実装している。
- `batch/commands/fetch.ts` と `batch/jobs/crawl.ts` に**fetch の責務が分散**。
- `batch/provider/github/provider.ts` が **fetch と analyze の両方を内包**し、Store/Fetcher/Aggregator が単発で組み合わさる設計。
- `batch/provider/github/pullrequest.ts` は**ドメイン計算（サイクルタイム・レビュー反応など）と永続化前整形**が混在。
- `batch/bizlogic/` と `batch/provider/github/` に **「分析ロジック」「データ取得」「I/O」が分断**されており、読解負荷が高い。

## リファクタリング方針（Fowler のカタログ適用 + 関数型ドメインモデリング）
- **Functional Core / Imperative Shell**: ドメイン計算は純粋関数、I/O は周辺に隔離する。
- **Algebraic Data / Value Objects**: PR 解析に必要な値を構造体（Value）として定義し、日付やメトリクスを明示的に扱う。
- **Split Phase**: fetch/analyze/upsert/export を段階分離し、引数・戻り値の境界を明示する。
- **Extract Function / Extract Class**: バッチ実行単位（1 org / 1 repo / 1 PR）の責務を関数/クラスに分離。
- **Introduce Parameter Object**: 乱立する設定値（org / repo / releaseDetection など）を凝集した DTO にまとめる。
- **Move Function**: ドメイン計算やデータ整形を I/O から切り離し、責務の近い場所へ移動。
- **Replace Conditional with Polymorphism**（適用候補）: provider 分岐は拡張点として明確化。

## 具体的なリファクタリング計画

### 1. バッチ実行の「ユースケース」単位を定義
**狙い**: `crawlJob` と `upsertCommand` の重複排除と凝集の向上。  
**適用カタログ**: Extract Function / Extract Class
- `batch/usecases/` などを新設し、以下のユースケースを切り出す。
  - `runOrganizationCrawl(organizationId | organization)`
  - `runOrganizationAnalyzeAndUpsert(organizationId | organization)`
  - `runRepositoryFetch(repository, options)`
- `batch/jobs/crawl.ts` と `batch/commands/upsert.ts` は **ユースケース呼び出しのみ**に寄せる。

### 2. ドメインモデルの関数化（Functional Core）
**狙い**: 解析ロジックを純粋関数に寄せ、I/O から独立させる。  
**適用カタログ**: Move Function / Extract Function / Introduce Parameter Object
- `buildPullRequests` を**純粋関数パイプライン**へ再構成し、I/O 依存を排除する。
- ドメイン値を `PullRequestFacts` / `ReviewArtifacts` / `CycleTimeMetrics` のような**値オブジェクト**で表現する。
- `review-response.ts` と `cycletime.ts` は**副作用なし**を維持し、入力/出力型を明確化する。

### 3. データ取得と解析の境界を明確化
**狙い**: fetch/analyze の責務を切り分けて凝集を高める。  
**適用カタログ**: Split Phase / Move Function
- `batch/provider/github/provider.ts` 内の `fetch` と `analyze` を分割し、
  - `fetcher` + `store` は **I/O フェーズ**
  - `buildPullRequests` は **解析フェーズ（純粋関数）**
  として位置づけを明確化する。
- `buildPullRequests` で扱う設定値を `AnalyzeContext`（Parameter Object）化。

### 4. PR 解析パイプラインの高凝集化
**狙い**: PR 単位の解析ロジックをまとめて理解しやすくする。  
**適用カタログ**: Extract Function / Move Function / Rename Method
- `buildPullRequests` を以下の小関数に分割。
  - `loadArtifacts(pr)`（commits/reviews/discussions）
  - `filterActors(pr, excludedUsers)`
  - `computeDates(pr, artifacts)`（firstCommittedAt 等）
  - `computeCycleTimes(dates)`（bizlogic/cycletime）
  - `buildPullRequestRow(dates, times)`（DB Insertable 生成）
- `review-response.ts` と `cycletime.ts` は **純粋関数群**として維持し、I/O を排除。

### 5. Export と Upsert の責務境界を統一
**狙い**: I/O フローの凝集向上と再利用性アップ。  
**適用カタログ**: Extract Function / Introduce Parameter Object
- `exportPullsToSpreadsheet` と `exportReviewResponsesToSpreadsheet` を、
  - `createSpreadsheetExporter(exportSetting)` のようなファクトリに統合し、
  - `export({ pulls, reviewResponses })` を提供する形にする。
- `upsertPullRequest` 周辺は **データ整形と DB I/O を分離**（timeFormat を事前に適用）。

### 6. Provider 抽象の明文化
**狙い**: 今後の provider 拡張時の凝集確保。  
**適用カタログ**: Replace Conditional with Polymorphism
- `createProvider` の戻り値に `Provider` 型を定義（fetch/analyze の I/O 契約を明文化）。
- `provider/github` 内で `GitHubProvider` 実装クラス（または factory）として束ねる。

### 7. 例外/ログの一元化
**狙い**: 例外処理の散在を抑えて凝集度を上げる。  
**適用カタログ**: Extract Function / Move Function
- 失敗時ログ (`consola` / `logger`) をユースケース層で統一し、
  - 解析層は基本的にエラーを throw
  - 実行層で捕捉してログ出力

## 影響の出ないことの最終確認（分析結果の不変性チェック）

### 1) ゴールデンデータ比較
- 既存 `data/`（json キャッシュ）を固定入力として、**リファクタ前後で出力が一致**することを確認。
- 比較対象：
  - `batch/commands/report.ts` の出力
  - `buildPullRequests` から生成される `pulls` と `reviewResponses`

### 2) スナップショット/差分確認
- 解析結果を JSON で書き出し、`diff` で差分がないことを確認（保存先は `tmp/golden/`）。
- 差分がある場合は以下を優先検証：
  - `firstReviewedAt` の算出ロジック
  - `releasedAt` の検出ロジック（branch/tags）
  - `excludedUsers` の適用

### 3) DB Upsert の結果一致
- `pullRequests` テーブルを対象に、
  - 件数一致
  - `number/repositoryId` 単位での主要カラム一致

### 4) Export 出力の一致
- `exportPullsToSpreadsheet` の出力内容（paste テキスト）を比較。

## 作業順序（推奨）
1. **Functional Core の切り出し**（純粋関数化・型定義）
2. **ユースケース層の抽出**（重複排除）
3. **Provider 抽象と I/O 層の整理**
4. **Export / Upsert の整理**
5. **最終検証（ゴールデン比較）**

---

必要なら、このプランに沿って実際の変更案（差分）まで続けます。
