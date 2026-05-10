# PR サイズの規律 (200 / 400 行ルール)

## 要点

PR は **目標 200 行、絶対上限 400 行**。これを超えるとレビューが詰まり、欠陥が増える。AI 時代に PR が膨れやすくなったため、規律を仕組みで強制する必要が増している。

## なぜ重要か

### 規模と質の関係

OSS プロジェクト 82 個の **212,687 PRs** を分析した実証研究 (augmentcode の解説経由) で、

- 200-400 LOC の範囲で **欠陥検出率 66-75%** が確認されている
- 欠陥密度のベースラインは **27 行に 1 件**
- 400 行を超えると、レビュアーの認知容量を超えて検出率と承認速度の両方が落ちる

「200 LOC 目標、400 LOC 上限」という運用基準は SmartBear、Augment Code、Google Code Review Guide 等で一貫して推奨されている。なお「40% 少ない欠陥」「3 倍速い承認」のような数値が二次ソースで流通しているが、原典が辿れないため本書では割愛している。

### レビューの認知容量

人間がコードを集中して読める時間は限られる (1 セッション 60 分が目安、それ以上は精度が落ちる)。400 行を超える PR はレビュアーが「全部は読まない」状態になり、結果的に**レビューなしと同じ**になる。

### AI 時代に悪化

DORA 2025 によると、AI 普及で PR サイズは平均 +51.3% 増えている。AI は「ついでに直す」が容易なため、関心事の混入した大きい PR が増える。これを放置するとレビュー詰まりが加速する。

## 具体的な実践

### 1. ハード上限のツール強制

- リント / CI で行数を計測して 400 行超を warn または block にする
- 例外フラグ (`big-pr` ラベル等) を作って、必要なときは明示的に外す
- `git diff --shortstat origin/main..` を pre-commit で出して、自分でも気づけるようにする

### 2. 段階的 PR で大機能を分割

大きな機能でも、PR は 200-400 行に保つ。詳細は [stacked-prs.md](./stacked-prs.md)。

### 3. レビュー前 split

PR を書き終えた後でも、レビューに出す前に「commit 単位で複数 PR に分けられないか」を確認する。具体的には:

- リファクタと機能追加を分ける
- 新機能と既存修正を分ける
- 自動生成ファイル (lock ファイル等) を別 PR にする

### 4. 1 PR = 1 関心事

「ついでに直した」を別 PR に出す習慣。AI を使うと「ついで」が容易なので、意識的に切り分ける。

## 落とし穴

| アンチパターン                | 何が問題か                                                      |
| ----------------------------- | --------------------------------------------------------------- |
| 行数だけ見て中身を無視        | 自動生成や lockfile で水増しされた PR を見逃す                  |
| 上限を緩める方向で運用        | 「今回だけ」が常態化する。例外は明示的に承認を取る形にする      |
| AI レビューで代替できると思う | AI レビューも認知容量に限界がある。大きい PR は AI でも見落とす |
| Stacked PR をやらない         | 大きな機能を分割せず「全部入り PR」になる                       |

## upflow での扱い

upflow は PR サイズの計測と分類を実装済み。

- ✅ PR ごとの行数 (additions + deletions) と changed_files を記録 (`pull_requests.additions` / `deletions` / `changed_files`)
- ✅ XS / S / M / L / XL の分類 (`docs/pr-size-classification-guide.md` 参照)
- ✅ Cycle Time の By Author / Longest PRs で PR サイズと時間の関係を表示
- ⚠️ 「サイズ別の長尾発生率」を主表示にする要件は issue #332 の RDD で検討中
- ❌ 上限超え時の警告 (CI 統合) は未対応

実テナントの計測でも、XS (50行未満) の PR と XL (1000行+) の PR では「上位の遅い側に入る確率」に **数倍の差** が見られ、サイズと遅延発生率に明確な正の相関がある (具体数値は issue #332 の内部調査参照)。

## 参考資料

- [Best Practices for Code Review (SmartBear) — 200-400 LOC の根拠](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/)
- [Code Review Best Practices That Actually Scale | Augment Code](https://www.augmentcode.com/guides/code-review-best-practices-that-scale)
- [Stacked Pull Requests - The Complete Guide](https://www.awesomecodereviews.com/best-practices/stacked-prs/) — Stacked PR と PR サイズの関係
- [How Teams Can Speed Up GitHub PR Reviews in 2026](https://www.codeant.ai/blogs/github-code-reviews)
