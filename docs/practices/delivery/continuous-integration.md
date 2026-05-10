# Continuous Integration (CI)

## 要点

DORA の定義: 「開発者が main に頻繁に変更を統合し、自動テストが毎回走る」運用。**テスト 10 分以内・毎日 main にマージ・broken build を即修正** が基準。CI は単なる「テストを CI サーバで走らせる」ではなく、**開発フロー全体の運用** を含む。

## なぜ重要か

DORA の言葉: 「if something takes a lot of time and energy, you should do it more often, forcing you to make it less painful」。統合作業が痛いほど頻度を上げて、毎回の負担を最小化する。

CI が機能しないと連鎖的に崩れる:

- テストが遅い → 開発者が結果を待たない → 壊れたコードが入る
- broken build を放置 → 全員ブロック → 開発が止まる
- daily merge できない → ブランチが長命化 → trunk-based ([trunk-based-development.md](./trunk-based-development.md)) が成立しない

## DORA の推奨実践

### 自動ビルド

- 各 commit が build を起動する
- 生成パッケージが「権威ある (authoritative) 」状態 = どの環境でもこれを使う
- 再現可能 (reproducible) = 同じ input から同じ output

### 自動テストスイート

- ユニットテスト + 受け入れテストで高価値機能をカバー
- 実行時間 **数分以内** (DORA 基準: ローカルでも CI でも 10 分以内)
- テストの中身は [test-automation.md](./test-automation.md) 参照

### CI システム

- check-in ごとに build/test を実行
- 結果が **チームに見える** 通知 (chat 推奨、email より速い)
- broken build は最優先で修正

### 開発フロー

- 開発者が **少なくとも毎日** trunk に merge
- 短命ブランチ (trunk-based の運用)
- broken build が出たら止まらず即修正

## DORA のアンチパターン

| 失敗                            | なぜ問題か                                             |
| ------------------------------- | ------------------------------------------------------ |
| build / repo 設定を自動化しない | 環境差異で「自分のマシンでは動く」が量産される         |
| テストが遅い (>10 分)           | 開発者が待たない → 結果を見ない → 機能しない CI になる |
| daily merge をしない            | 長命ブランチが生まれ、trunk-based が崩れる             |
| broken build の修正を後回し     | 全員ブロックの時間が伸びる                             |
| 通知を email に頼る             | 反応が遅れる。chat の即時性が必要                      |

## AI 時代の論点

### CI 実行回数の急増

DORA 2025: AI 普及で個人 PR マージ数 **+98%**。CI 実行回数も同程度増える。

- CI が遅いと連鎖的に詰まる (PR 数が倍になれば CI 待ち時間も倍)
- CI 並列度 / cache / test sharding の重要性が増す
- 1 PR の CI 時間より **キュー長と並列度** が支配的になる

### AI 生成 PR の特性

- AI 生成 PR は「ついでに直す」が多く [pr-size-discipline.md](../pr-flow/pr-size-discipline.md) で書いた通り PR サイズが膨れる
- 大きい PR ほど CI 時間が伸びる (テスト範囲が広い、build cache が外れる)
- 結果、AI 時代の CI は「短い PR を多数」を前提に最適化する必要がある

### マージキューとの関係

[../pr-flow/merge-queue.md](../pr-flow/merge-queue.md) は CI が前提:

- マージキューは「キューの先頭で CI 実行 → green なら merge」を繰り返す
- CI が 30 分かかると、キューに 10 件並んだら 5 時間待ち
- マージキューの導入には CI 時間 < 10 分が事実上の前提

## 計測

DORA の計測項目:

- 自動 build / test を起動する commit の割合
- 日次の正常実行率
- テスターが build を使えるか
- 開発者への feedback 速度
- broken build の修正時間

加えて AI 時代では:

- CI キュー長の推移
- 並列度の利用率
- flaky 失敗率 (再実行で通るもの) — [test-automation.md](./test-automation.md) と接続

## upflow での扱い

- ✅ GitHub Actions: PR ごとに `pnpm validate` (lint + format + typecheck + build + test)
- ✅ E2E テスト: PR ごとに Playwright 実行 (`.github/workflows/`)
- ✅ ブランチ保護: PR 経由のみ main マージ可
- ⚠️ CI 実行時間: 全部で約 5-10 分。基準は満たすが余裕は少ない
- ❌ chat 通知: なし。email / GitHub Web UI で確認している
- ❌ flaky 監視: 仕組みなし
- ❌ CI 実行時間の継続計測: 仕組みなし
- ❌ キュー長の可視化: なし (マージキュー未導入なので不要)

特に **CI 実行時間の継続計測** は upflow が dashboard 機能として持てる範囲。AI で PR が増えていく中、CI 速度の推移を見えるようにする価値がある。

## 関連

- [test-automation.md](./test-automation.md) — CI で走るテストの自動化
- [trunk-based-development.md](./trunk-based-development.md) — 短命ブランチと daily merge は CI の前提
- [continuous-delivery.md](./continuous-delivery.md) — CI を含むより広い概念
- [../pr-flow/merge-queue.md](../pr-flow/merge-queue.md) — CI 安定性が前提のマージ運用

## 参考資料

- [DORA: Continuous Integration](https://dora.dev/capabilities/continuous-integration/) — 一次ソース
- [Continuous Integration (Martin Fowler)](https://martinfowler.com/articles/continuousIntegration.html) — CI の元論文相当
- [Accelerate](https://nicolefv.com/book) — 書籍。CI と DORA メトリクスの関係
