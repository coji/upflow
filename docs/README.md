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

## 参照メモ

- [guides/gemini-prompting.md](./guides/gemini-prompting.md)
  LLM 利用時のプロンプト運用メモ

## 整理方針

- 計画は `roadmap.md` に集約する
- 各機能ドキュメントには「目的・依存・最小スコープ」だけ残す
- 実装済みの移行メモや、重複したフェーズ計画は残さない
- 直近のジョブ基盤は Node + Durably を前提にする
