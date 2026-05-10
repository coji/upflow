# 初回レビュー応答時間の SLA

## 要点

「PR を開いてから最初のレビューが返ってくるまで」を 6 時間以内に保つ運用ルール。これを守れないチームは、PR が放置される文化が根付く。AI 時代に PR 数が増えると、放置 PR の山が顕在化しやすい。

## なぜ重要か

### 「投げて待つ」時間の問題

PR 著者の体験で最も悪いのは、投げた PR に**何の反応もない時間**。これが長いと:

- 著者は別タスクに切り替え → context が抜ける → レビュー指摘が来てから戻ると非効率
- 後続の段階的 PR を出せない (レビュー前提の場合)
- 「後で見る」が積み重なって永遠に放置される PR が出る

### 中央値ではなく初回応答時間

cycle time の Pickup Time は「最初のレビュー」までの時間として計測される (upflow も同じ定義)。これが Review Time の長尾を作る源になる。

> **計測の差**:
>
> - Pickup Time: PR open → 最初の review コメント or 承認
> - Review Time: 最初のレビュー → マージ

初回応答が遅いと Pickup が伸び、それは Review に振り分けても解消しない。

### 業界目標

業界の調査では **6 時間以内** が High performer の目安。8 時間 (1 営業日) を超えると詰まり始める。jtcc データでは Pickup の中央値は 0.14d (3.4 時間) で目安内だが、上位 10% は 4.14d (約 4 日) と大きく外れている (issue #332 調査参照)。

## 具体的な実践

### 1. レビュアーの当番制

- 「今日の PR レビュー担当」を 1〜2 人決める (rotation)
- その人は他のタスクより PR レビューを優先する
- Slack / Teams で「今日は私がレビュー当番です」と宣言

これにより「みんなが見るだろう」の責任分散を消す。

### 2. PR 通知の経路を限定

- PR は 1 つの専用チャンネルに通知 (チームの会話に埋もれない)
- 通知は requested reviewer が指名されたときに即時
- レビュー応答も同じチャンネルでスレッド化

### 3. 「2 時間ルール」のセルフチェック

レビュアー側の習慣:

- 朝、昼休み前、夕方の 3 回、PR 一覧を見る (= 自然と最大 4 時間以内に拾う)
- それより速くしたい場合は通知をリアルタイムで見る運用

### 4. 緊急 PR の経路

- 通常 SLA とは別に「緊急レビュー要求」の手順を持つ
- 緊急タグ + 直接 mention で即時要求
- 通常 PR にはこれを使わない (ノイズ化を防ぐ)

### 5. 計測と可視化

- 初回応答時間 (Pickup) を週次でモニター
- 中央値だけでなく **上位 10% (p90)** も見る (中央値だけだと放置 PR が見えない)
- 6 時間 SLA 違反の PR を別途リストアップ

## 落とし穴

| アンチパターン                   | 何が問題か                                                      |
| -------------------------------- | --------------------------------------------------------------- |
| 中央値で SLA を判定              | 中央値が良くても上位 10% が放置されているケースを見逃す         |
| 全 PR に同じ SLA                 | bot PR (Renovate 等) は人間レビュー不要のものもある。分類が要る |
| 当番制を作らず「みんなで見る」   | 結局誰も見ない                                                  |
| レビュアー指名されるまで開かない | indication なしでもレビュー可能な仕組みにする (auto-assign 等)  |
| 著者が後追いで催促する文化       | 仕組みで解決すべき。著者の負荷を増やさない                      |

## AI レビューとの関係

AI レビューツール ([ai-human-split.md](../code-review/ai-human-split.md) 参照) は **初回応答時間を短縮する強力な手段**。

- AI レビューが PR 開いて 1-2 分以内に lint / セキュリティ / 軽微な指摘を返す
- これにより著者は「まず AI 指摘を直す」サイクルに入れる
- 人間レビュアーは AI 指摘で済むものを見なくて良くなる
- 結果、人間の初回応答に余裕ができる

ただし **AI レビューを「初回応答」とカウントしない**。人間レビューの SLA とは別管理にする。

## upflow での扱い

upflow は Pickup Time として計測している。

- ✅ Pickup Time の中央値・平均・期間別推移
- ✅ Pickup Time の長尾 (Longest PRs に表示)
- ⚠️ SLA 違反 PR (6 時間超) の独立した可視化は未対応 (issue #332 で再設計検討中)
- ❌ レビュアー当番との突き合わせ機能はない
- ❌ AI レビューと人間レビューの分離計測はない (raw データに reviewer 名はあるので技術的には可能)

jtcc では Pickup Time 中央値 0.14d (3.4h) は SLA 内だが、上位 10% (p90) 4.14d は明確に外れている。中央値中心の表示を信じると「うちは速い」と誤読する典型例。

## 参考資料

- [Code Review Best Practices That Actually Scale | Augment Code](https://www.augmentcode.com/guides/code-review-best-practices-that-scale) — 6 時間 SLA の根拠
- [How to Reduce Pull Request Cycle Time for Faster Code Reviews](https://www.getpanto.ai/blog/how-to-reduce-pull-request-cycle-time-for-faster-code-reviews)
- [Reducing pull request cycle time | Swarmia](https://help.swarmia.com/pull-request-cycle-time-in-swarmia)
- [Reduce cycle time with effective pull requests | CircleCI](https://circleci.com/blog/reduce-cycle-time-pull-requests/)
