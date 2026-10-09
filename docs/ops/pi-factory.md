# pi + Muse Spark 無料枠でのレビュー運用

pi と Muse Spark 無料枠を使ったレビュー運用の参照点。次回以降の作業で
「どう回すか」を思い出すためのメモであり、既存 docs の構成変更・
コード変更・CI や takt への組み込みは対象外。

## 前提

- pi 0.85 以上 (`pi --version` で確認。確認時点: 0.85.1)
- Zen API キーは不要。`OPENCODE_API_KEY=public` で無料枠モデルを利用する
- レビュー基準は `.agents/skills/review/SKILL.md` (Blocker のみ報告)
- opencode 側の同等物は `.opencode/commands/review.md`
  (モデル `opencode/muse-spark-1.3-contributor-free`)

## レビュー実行コマンド例

差分かファイル参照を添えて review スキルを起動する。無料枠で回す場合は
モデルを明示する (`--model` は `provider/id` 形式。詳細は `pi --help`)。

```bash
# ブランチ差分のレビュー
git diff main...HEAD > /tmp/review.diff
pi --model opencode/muse-spark-1.3-contributor-free -p \
  ".agents/skills/review の基準で @/tmp/review.diff をレビューして"
```

```bash
# ファイル指定のレビュー
pi --model opencode/muse-spark-1.3-contributor-free -p \
  ".agents/skills/review の基準で @app/services/example.ts をレビューして"
```

判定はスキルの出力形式に従う (`## Verdict: PASS` / `## Verdict: FIX`)。
FIX の場合のみ `## Blockers` を直し、Follow-ups は直さない。

## spec → implement の流れ

1. **spec**: `.agents/skills/spec/SKILL.md` に従い、Issue から仕様書を書く。
   冒頭に `## Scope lock` (目的・やらないこと・受け入れ条件) を置き、
   review スキルの基準で自己レビューしてから保存する。コード変更はしない。
2. **implement**: `.agents/skills/implement/SKILL.md` に従い、
   ブランチ作成 → 実装 (Scope lock の範囲内のみ) → 検証 →
   コミット (push はしない) → review 基準で差分を自己レビューする。
   Blocker があれば直してコミット追加し、通るまで繰り返す (最大3周)。

## 制約

- **無料枠の動的クォータ**: 無料枠の利用量上限は動的に変わる。
  混雑時は使えないことがある前提で、使えなければ待つか人間レビューに切り替える。
  上限値は変わるため本書に書かない。
- **学習利用**: 無料枠のモデルはプロンプトが学習に使われる
  (`.opencode/commands/review.md` の注意書き参照)。
  次項の機密ルールを守れば問題ないが、念のため不要な情報は渡さない。
- **機密ルール**: `docs/agent-rules/confidentiality.md` に準拠する。
  顧客名・テナント slug・顧客 ID・顧客データ由来の具体数値・顧客の人物名
  (GitHub username 含む) をプロンプト・docs・コミットメッセージ・PR 本文に書かない。
  抽象化の書き換え例は同ドキュメントの表を参照。
