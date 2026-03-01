# レビューボトルネック可視化ダッシュボード 設計書

## 1. 背景と目的

### 背景

AIコーディングエージェント（Claude Code, GitHub Copilot, Cursor 等）の普及により、コード生成速度が飛躍的に向上した。一方で、人間によるコードレビューの処理能力は変わらず、PRレビューがチーム全体のスループットのボトルネックとして顕在化している。

lab での実データ分析（実顧客組織、約5,000 PR）では:

- **13四半期中12四半期で review time がボトルネック**
- pickup time の二極化: 1/3 はエリート基準（75分以内）だが、1/5 は4日以上放置
- author 別で最大 **8倍** の待ち時間差
- LLM分類で PR の **70%** が XS/S（自動マージ可能）、キュー **50%削減** の余地

### 目的

- **チーム全体のスループット向上** のための可視化
- 「溜まっている」ことではなく **なぜ溜まるか** の構造を示す
- **チームで「どうする？」と話すきっかけ** にする（個人を責めるのではなく構造を議論する材料）

### 設計原則

- **構造を見せる**: 個人の問題ではなくシステムの問題として可視化する
- **議論を促す**: 答えを出すのではなく、チームが考える材料を提供する
- **既存データ活用**: 基本は既存データで実現し、LLM分類のみオプショナルに追加

---

## 2. ルートと画面構成

### ルート

`/{orgSlug}/reviews` — サイドバーの Analytics グループに追加（Dashboard, Ongoing に続く3番目）

### 画面構成

```text
┌────────────┬──────────────────────────────────────────────┐
│ Sidebar    │                                              │
│            │  Review Bottleneck          [Team▼] [3M▼]   │
│ Analytics  │                                              │
│  Dashboard │  ┌──────── A. 誰に詰まっているか ─────────┐ │
│  Ongoing   │  │                                         │ │
│  ★Reviews │  │  [横棒グラフ: レビュアー別キュー深度]   │ │
│            │  │  reviewer-A  ████████ 8                  │ │
│            │  │  reviewer-B  █████ 5                     │ │
│            │  │  reviewer-C  ███ 3                       │ │
│            │  └─────────────────────────────────────────┘ │
│            │                                              │
│            │  ┌──── B. 同時に抱えるほど遅くなる ───────┐ │
│            │  │                                         │ │
│            │  │  [棒グラフ: WIP別 review_time 中央値]   │ │
│            │  │  WIP 0-1: Xh  WIP 2: Yh  WIP 3+: Zh   │ │
│            │  └─────────────────────────────────────────┘ │
│            │                                              │
│            │  ┌──── C. 自動化でキューを減らせる ───────┐ │
│            │  │                                         │ │
│            │  │  [棒グラフ×2: サイズ分布, サイズ別時間] │ │
│            │  │  XS/S = N% → review中央値Xh             │ │
│            │  │  「自動マージでY%削減」                   │ │
│            │  └─────────────────────────────────────────┘ │
└────────────┴──────────────────────────────────────────────┘
```

---

## 3. セクション詳細

### A. レビューキューの人別分布 —「今、誰に詰まっているか」

**目的**: レビュー負荷の偏りを可視化。特定の人に集中していることをチームで認識する。

**データソース**: `pull_request_reviewers` × `pull_requests(state='open')` — リアルタイムのスナップショット

**ロジック**:

1. open な PR に対してレビュー依頼されている人を集計
2. 既にレビュー済み（APPROVED / CHANGES_REQUESTED）の人は除外
3. レビュアー別にカウントし、多い順にソート

**UI**: 横棒グラフ（Recharts BarChart, layout="vertical"）

- X軸: 待ちPR数、Y軸: レビュアー名（display_name）
- 色: 件数に応じた段階的な色分け

**フィルタ**: チームのみ（期間フィルタなし — 現在のスナップショット）

### B. WIP数とサイクルタイムの関係 —「同時に抱えるほど遅くなる」

**目的**: レビュー待ちの間に新しいPRを出すと、チーム全体が遅くなる構造を示す。

**データソース**: `pull_requests`（マージ済み）— サブクエリでWIP数を算出

**ロジック**:

1. マージ済みPRそれぞれに対して、そのPRの作成時点での author の WIP数（同じ author が同時に open していた PR 数）を clientLoader で算出
2. WIP数をグループ化（0-1 / 2 / 3 / 4+）し、各グループの review_time 中央値を計算

**UI**: グループ別棒グラフ（Recharts BarChart）

- X軸: WIPグループ（WIP 0-1, WIP 2, WIP 3, WIP 4+）、Y軸: review_time 中央値（時間）
- 各バーの下に n=件数 を表示
- 補助テキスト: 「WIP 0-1 の中央値: Xh → WIP 3+: Yh（Z倍）」

**フィルタ**: チーム + 期間

### C. PRサイズ分布と自動化の余地 —「人がレビューすべきでないPRがキューを圧迫」

**目的**: シンプルなPRがレビューキューを圧迫している構造を示し、自動化の議論を促す。

**データソース**: `pull_requests`（マージ済み、additions/deletions あり）

**ロジック**:

- `additions + deletions` でサイズ分類: XS(≤10), S(≤50), M(≤200), L(≤500), XL(500+)
- サイズ別の PR 件数と review_time 中央値を算出

**UI**: 2つの棒グラフ横並び

1. サイズ別 PR 件数分布
2. サイズ別 review_time 中央値
3. 補助テキスト: 「全PRの N% が XS/S。review_time 中央値は X時間。自動マージすればレビュー負荷を Y% 削減」

**フィルタ**: チーム + 期間

---

## 4. フィルタ

| フィルタ | 対象セクション | UI                               | デフォルト |
| -------- | -------------- | -------------------------------- | ---------- |
| チーム   | A, B, C        | TeamFilter（既存コンポーネント） | 全チーム   |
| 期間     | B, C           | セレクタ（1M / 3M / 6M / 1Y）    | 3ヶ月      |

セクション A はリアルタイムのスナップショットなので期間フィルタ不要。

---

## 5. ファイル構成

```text
app/routes/$orgSlug/reviews/
├── index.tsx                    # ページ + loader + clientLoader（集計処理）
├── +functions/
│   ├── queries.server.ts        # 3つのクエリ関数
│   ├── aggregate.ts             # clientLoader 用集計ロジック（純粋関数）
│   ├── aggregate.test.ts        # 集計ロジックのテスト
│   ├── classify.ts              # PRサイズ分類（LLMフォールバック付き）
│   └── classify.test.ts         # 分類ロジックのテスト
└── +components/
    ├── reviewer-queue-chart.tsx  # A. レビュアー別キュー深度
    ├── wip-cycle-chart.tsx       # B. WIP vs サイクルタイム
    └── pr-size-chart.tsx         # C. PRサイズ分布

app/components/layout/
└── nav-config.ts                # Analytics に Reviews を追加
```

---

## 6. 技術的な設計

### 既存パターンの踏襲

- `requireOrgMember` でアクセス制御（admin限定ではなく全メンバー閲覧可）
- `getTenantDb(organizationId)` でテナントDB取得
- `companyGithubUsers` との LEFT JOIN で display_name 取得
- Recharts + shadcn/ui の ChartContainer / ChartTooltip
- bot 除外: `author NOT LIKE '%[bot]%'`

### 必要なデータ（全て既存DB内）

| テーブル                 | 用途                               |
| ------------------------ | ---------------------------------- |
| `pull_requests`          | PR基本情報、サイクルタイム、サイズ |
| `pull_request_reviewers` | レビュー依頼先（誰に頼んだか）     |
| `pull_request_reviews`   | レビュー実績（誰がいつ何をしたか） |
| `repositories`           | チーム紐付け                       |
| `company_github_users`   | 表示名                             |

新規テーブル追加: **なし**
LLM分類用カラム追加（`pull_requests`）: `complexity`, `complexity_reason`, `risk_areas`, `classified_at`, `classifier_model`

---

## 7. 将来の拡張

- レビュアー × author のヒートマップ（誰が誰の PR をレビューしているか）
- レビュー負荷のジニ係数（偏りの数値化）
- Slack 通知連携（キューが閾値を超えたらアラート）
