# 機密情報の扱い (NDA 配慮)

upflow は複数の顧客テナントの実データを扱う。NDA があるため、顧客名・テナント識別子・顧客データ由来の具体数値を **外部から見える面に書かない**。

## 公開面 vs 内部のみ

| 面                                        | 誰が見るか                                      | 機密情報を書いて良いか                                     |
| ----------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| GitHub PR description                     | 公開リポなら世界中 / 非公開リポでもメンバー全員 | ❌ 書かない                                                |
| GitHub commit message                     | 同上 (git log に永続)                           | ❌ 書かない                                                |
| `docs/` 配下                              | 同上                                            | ❌ 書かない                                                |
| README / `.github/`                       | 同上                                            | ❌ 書かない                                                |
| GitHub issue 本文・コメント               | 同上                                            | ⚠️ 内部 issue で運用しているなら可、迷ったら避ける         |
| CLAUDE.md / docs/agent-rules/             | 同上 (リポに含まれる)                           | ❌ 書かない (例として挙げる場合は「顧客 A」のように匿名化) |
| ローカルファイル (`data/`, `.takt/logs/`) | 自分のマシンのみ                                | ✅ 制限なし                                                |
| 内部 issue / 内部 RDD への参照            | 「issue #N の内部調査参照」と書ける             | ✅ ポインタとしてのみ可                                    |

`data/` `.takt/logs/` `.takt/state/` 等のローカル成果物は `.gitignore` に入っているので git に上がらない前提。新しいローカルディレクトリを作るときは `.gitignore` を確認する。

## 機密の定義

以下を「機密」と扱う:

1. **顧客名・テナント slug**
   - データベース上の `organizations.slug` の値、社名、社内プロジェクト名はすべて機密と扱う
   - シードデータの `seed-admin` 等の運用 slug は対象外 (`app/libs/reserved-slugs.ts` 参照)
2. **顧客 ID**
   - tenant DB のファイル名 (`tenant_<id>.db` の `<id>`)
   - `organizations.id`、`members.id` 等の内部 ID
3. **顧客データ由来の具体数値**
   - PR 数、ユーザー数、特定の比率、所要時間の生値 (median、平均、p90、p99 等)
   - 「ある実テナントで観測された値」と読める数値はすべて機密
4. **顧客の人物名**
   - `pull_requests.author`、`pull_request_reviews.reviewer` の値
   - GitHub username も機密に含める (社内の人かは外部から判別困難なため)

## 抽象化のルール

機密を出さずに同じ趣旨を伝える書き換え:

| 元の表現 (NG)                                 | 抽象化後 (OK)                                            |
| --------------------------------------------- | -------------------------------------------------------- |
| 「<顧客slug> データでは」                     | 「実テナントの計測では」「ある実テナントの実データでは」 |
| 「<顧客slug> では PR 数 N 件」                | 「数千〜万件規模の実テナントでは」                       |
| 「median X日、p90 Y日」                       | 「中央値は SLA 内だが上位 10% は数日単位で外れる」       |
| 「上位 10% が cycle time の N% を作っている」 | 「上位の遅い側 PR が cycle time の大半を占める」         |
| 「author <名前> が PR N 件」                  | 「特定 author に投稿が偏っている」                       |
| 具体的なリポジトリ名                          | 「対象リポジトリの 1 つ」                                |

詳細値が必要な議論は **内部 issue / 内部 RDD** に書き、公開面からは「`#332 の内部調査参照`」のように **参照だけ** 残す。

## 防御の階層

完全防御には 3 層が要る:

1. **意識** (本ドキュメント + CLAUDE.md のポインタ): self-review 時に思い出す
2. **習慣** (auto memory `feedback_nda_*.md`): 過去の失敗を context に持ち込んで再発を防ぐ
3. **仕組み** (pre-commit hook `.confidential-terms.local`): 物理的にブロック (将来追加予定)

CLAUDE.md は「Claude Code が約 80% 守る」という前提で設計されているので、3 の物理防御を必ず併設する。

## 違反したときの対応

外部公開面に機密を書いてしまったら:

1. **即修正**: docs / PR description / commit message を抽象化版に書き換える
2. **コミット履歴に残った場合の判断**: PR description / docs ファイルの修正が最優先。コミットメッセージの履歴 rewrite (force-push) は破壊的なのでユーザー確認の上で実施
3. **再発防止**: auto memory に失敗事例として記録 (`feedback_nda_<context>.md`)。同じ文脈で次回トリガーされる
4. **物理防御の更新**: `.confidential-terms.local` に該当語を追加 (将来導入後)

## 参考

- 業界の AI ガードレール 3 層モデル (input / output / runtime) のうち、本書は output 層の手動運用を扱う
- M&A NDA に AI 条項を入れる動きが 2026 年から標準化しつつある (機密情報を AI に渡さない条項、データ保持型ツールの利用制限等)
- 関連: [docs/practices/code-review/ai-human-split.md](../practices/code-review/ai-human-split.md) — AI レビューに何を渡すかも本ルールに従う
