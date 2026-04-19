# Docs

`docs/` は「今やること」と「後で効く設計メモ」を分けて管理する。

## いま参照するもの

- [roadmap.md](./roadmap.md)
  現在の実行順。近い将来の判断はこれを正本にする
- [auth.md](./auth.md)
  認証と GitHub ユーザー管理の設計

## 将来案

- [future-ideas.md](./future-ideas.md)
  直近ではやらないが、方向性として残しておく機能案

## 機能ガイド・計画

- [pr-size-classification-guide.md](./pr-size-classification-guide.md)
  PR サイズ分類（XS〜XL）の運用ガイド。開発マネージャー向け
- [pr-size-feedback-loop.md](./pr-size-feedback-loop.md)
  LLM 分類を人間の暗黙知で補正するフィードバックループ計画

## 設計記録（RDD）

実装着手前に判断を固めた設計ドキュメント。完了済みも参照用に残す。

- [rdd/](./rdd/) — 一覧は [rdd/README.md](./rdd/README.md)

## 参照メモ

- [guides/gemini-prompting.md](./guides/gemini-prompting.md)
  LLM 利用時のプロンプト運用メモ

## 整理方針

- 計画は `roadmap.md` に集約する
- 設計判断は `rdd/` に残す（完了時は `## Status` を追加）
- 実装が完了した段階的な移行メモ・作業計画は削除する（git history に残る）
- 直近のジョブ基盤は Node + Durably を前提にする
