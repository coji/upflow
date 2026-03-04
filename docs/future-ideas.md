# Future Ideas

直近では着手しないが、方向性として残しておく機能案。

## Reviews Dashboard

レビューの詰まり方をチーム単位で可視化する分析画面。

### 価値

- レビュー待ちの偏りを見えるようにする
- 個人を責めず、構造の問題として議論しやすくする
- チームの改善アクションを決める材料になる

### 最小スコープ

- ルート: `/{orgSlug}/reviews`
- レビュアー別のキュー深度
- WIP 数と review time の関係
- PR サイズ分布と review time

### 依存

- `pull_request_reviews` が安定して更新される
- `pull_request_reviewers` が安定して更新される
- webhook 主経路または補完 crawler により、open PR の状態が古すぎない

### 後回し

- Slack 通知
- 複雑なスコアリング
- 個人評価っぽく見えるランキング
- LLM 依存の強い機能

## Personal Dashboard

エンジニア個人向けの「今日のアクション」画面。

### 価値

- 「今日、最初に何をやるべきか」を短時間で判断しやすくする
- Upflow を状態確認だけでなく、行動を決める道具に寄せる
- 日次利用の理由を作りやすい

### 最小スコープ

- ルート: `/{orgSlug}/me`
- レビューする
- コメントに対応する
- マージする
- レビュー待ち

### 依存

- `pull_request_reviews` が安定保存されている
- `pull_request_reviewers` が安定保存されている
- `pull_requests.additions / deletions / changed_files` が揃う
- `companyGithubUsers.userId` による GitHub login 紐付け
- webhook 主経路で open PR の状態が古すぎない

### 判断

- 価値は大きい
- ただし依存が多い
- `Reviews Dashboard` より後に考える
