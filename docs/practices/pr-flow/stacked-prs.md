# 段階的 PR (Stacked PRs)

## 要点

大きな機能を、互いに依存する小さな PR の連鎖に分割する手法。各 PR は前の PR をベースにする。レビュー中に次の層を作れるので、待ち時間が消える。2026 年に GitHub が公式 CLI (`gh stack`) を出して導入障壁が下がった。

## なぜ重要か

### 「大きい機能 = 大きい PR」の呪い

[pr-size-discipline.md](./pr-size-discipline.md) のとおり PR は 200-400 行が目標だが、機能自体が大きい場合は 1 PR では収まらない。従来の選択肢は:

1. **巨大 PR**: レビューで詰まる、欠陥が増える
2. **逐次 PR**: 1 つマージしてから次を書き始めると、レビュー待ちで手が止まる

段階的 PR は **3 つ目の選択肢**。前の PR がレビュー中でも、それをベースに次の PR を作って push できる。

### 効果

- 各 PR は 200-400 行に保てる → レビュー速度 3 倍、欠陥 40% 減 (PR サイズの効果がそのまま乗る)
- 著者は手が止まらない (レビュー応答待ちでも先に進める)
- レビュアーは段階ごとに集中できる (一度に大きいものを読まない)

## 仕組み

### ブランチ構造

```
main
 └── feature/foo-1-rename       (PR #100, 100 行)
      └── feature/foo-2-extract  (PR #101, 200 行, base = foo-1-rename)
           └── feature/foo-3-add (PR #102, 300 行, base = foo-2-extract)
```

各 PR は **直前のブランチ** を base にする。main を base にしない。

### マージ順序

1. `foo-1-rename` がマージされる
2. `foo-2-extract` の base が自動的に main に切り替わる (GitHub 側の挙動)
3. `foo-3-add` の base は `foo-2-extract` のまま (次に持ち上がる)

レビュー → マージを繰り返すと、上から順に main に流れていく。

### 途中で前の PR を修正したら?

レビュー指摘で `foo-1-rename` を修正すると、`foo-2` `foo-3` も rebase が必要。これを手動でやるのは面倒。ツールで自動化する。

## 具体的なツール

| ツール                            | 特徴                                                                         | 状況               |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------ |
| **`gh stack`** (公式 CLI 拡張)    | 2026 年に GitHub が出した。`gh stack sync` で連鎖 rebase + atomic force-push | 標準化されつつある |
| **Graphite**                      | 商用。Web UI も提供                                                          | 大手で採用多       |
| **ghstack** (Meta)                | OSS。Phabricator 風                                                          | 古参。Meta 由来    |
| **Sapling / Stacked Diff (Meta)** | git 代替 SCM                                                                 | 学習コスト高       |
| **git-spice**                     | OSS の CLI ツール                                                            | 軽量               |

**推奨**: 新規導入なら `gh stack` から試す。GitHub 純正なので保護ルールや CI との統合が一番素直。

## 落とし穴

| アンチパターン                                   | 何が問題か                                                   |
| ------------------------------------------------ | ------------------------------------------------------------ |
| 全部の PR の base を main にする                 | 単なる小 PR の束。依存関係が見えない                         |
| force-push の連鎖を手動でやる                    | ミスが起きる。ツールに任せる                                 |
| CI を各 PR で全部走らせる                        | 重複実行で CI コストが膨らむ。マージ時のみ走らせる工夫が要る |
| 著者がレビュアーに「上から順に」と説明していない | レビュアーが下層から見て混乱する                             |
| Stack が深くなりすぎる                           | 5 段以上は管理が複雑になる。3-4 段が目安                     |

## CI / 保護ルール

- **保護ルール**: 各 PR の base に対してではなく、**最終 target (main) に対して** 適用する。`gh stack` はこれを前提に設計されている
- **CI**: 各層で main を target として実行する (実際の base ではなく)。これにより「main にマージしたらどうなるか」が常に見える
- **マージキュー**: 段階的 PR とマージキュー ([merge-queue.md](./merge-queue.md)) を併用する場合、層単位で順序を守る設定が要る

## upflow での扱い

upflow は段階的 PR の利用状況を直接計測していない (PR の base を見れば技術的には可能)。

- ❌ 段階的 PR の利用率の可視化 (未対応)
- ❌ 段階的 PR と通常 PR の cycle time 比較 (未対応)
- ✅ PR ごとの base ブランチは raw データで保持 (`pullRequests.target_branch`) — 集計層で使えば実装可能

upflow の開発自体には段階的 PR は導入していない (2026年5月現在)。1 PR = 1 issue の運用が定着しているため、必要性が薄い。

## 参考資料

- [GitHub Targets Large Merge Problem with Stacked PRs (InfoQ, 2026)](https://www.infoq.com/news/2026/04/github-stacked-prs/) — `gh stack` 公開記事
- [Stacked Pull Requests - The Complete Guide for Developers](https://www.awesomecodereviews.com/best-practices/stacked-prs/)
- [My workflow for stacked PRs on GitHub (Dave Pacheco's Blog, 2025)](https://www.davepacheco.net/blog/2025/stacked-prs-on-github/)
- [Understanding the Stacked Pull Requests Workflow (Tower Blog)](https://www.git-tower.com/blog/stacked-prs)
