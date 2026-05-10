# Agent rules

CLAUDE.md から逃がした、agent (Claude Code 等) 向けのドメイン固有ルールの置き場。

## なぜ別ディレクトリか

CLAUDE.md は **「全タスクに普遍的に適用される指示」** だけを置く方針 (Claude Code 公式ベストプラクティス: "as few instructions as possible"、本リポジトリの方針もこれに準拠)。

特定のドメイン (機密情報、外部サービス連携、特定領域の運用ルール等) はここに分離する:

- 普遍的でないルールが CLAUDE.md を肥大化させない
- 詳細が必要な場面でだけ参照するので認知負荷が低い
- ルール改訂時に CLAUDE.md の他の節に影響しない

## 一覧

- [confidentiality.md](./confidentiality.md) — 顧客情報・機密データの扱い (NDA 配慮)

## CLAUDE.md からの参照方法

CLAUDE.md には **3 行以内のポインタ** だけ置く。詳細・例・背景はここに集約。

```markdown
### 外部公開時の機密情報チェック

PR / commit / docs に **顧客名・テナント slug・顧客由来の具体数値を書かない**。
詳細: [docs/agent-rules/confidentiality.md](./docs/agent-rules/confidentiality.md)
```
