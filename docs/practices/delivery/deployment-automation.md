# Deployment Automation

## 要点

DORA の定義: 「ボタン一発でテスト環境・本番環境にソフトウェアをデプロイできる仕組み」。デプロイリスクを減らし、迅速な品質 feedback を可能にする。**Deploy Time** (cycle time の構成要素) を直接決める能力。AI 時代に PR 数が増えるほど、自動化されていないデプロイは支配的なボトルネックになる。

## なぜ重要か

### Deploy Time を決める基底要因

upflow の cycle time は Coding → Pickup → Review → **Deploy** で構成される。Deploy Time は:

- 自動デプロイなら数分〜数十分
- 手動承認・手動オペレーションが入ると数時間〜数日

PR が小さく早くなっても、Deploy が遅いと cycle time 全体が縮まない。

### AI 時代の負荷増

DORA 2025: 個人 PR マージ数 +98%。デプロイ回数も増える。手動デプロイのままだと:

- 1 日に何回もリリース作業
- リリース担当が疲弊
- 「まとめてデプロイしよう」が起きてバッチ化 → trunk-based の精神に反する

## DORA の推奨実践

### 1. 環境間で同一プロセス

テスト環境と本番で**同じデプロイ手順**を使う。本番デプロイ前に他環境で十分にプロセスを試せる。「本番だけ手順が違う」は典型的な anti-pattern。

### 2. オンデマンド自律性 (On-demand autonomy)

DORA の言葉そのまま:

> 「Allow anyone with the necessary credentials to deploy any version of the artifact to any environment on demand in a fully automated fashion」

権限ある人なら誰でも、任意のバージョンを任意の環境にいつでもデプロイできる。承認待ちで詰まらない。

### 3. パッケージの一貫性

- 同じパッケージをすべての環境にデプロイする
- **環境固有の設定はパッケージから分離** する
- 「テスト環境用にビルド」「本番用にビルド」を分けない

### 4. 環境状態の再現可能性

バージョン管理された情報から、どの環境の状態も再現できる。災害復旧のため。Infrastructure as Code (Terraform / Pulumi) の文脈。

### 5. 必要なインプット

自動デプロイには:

- CI 生成のパッケージ (どの環境にもデプロイ可能)
- 設定スクリプト・デプロイスクリプト・smoke test スクリプト
- 環境ごとの設定データ

これらすべてが **バージョン管理** されている必要がある。

## DORA のアンチパターン

| 失敗                                   | なぜ問題か                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------- |
| **複雑な手動プロセスをそのまま自動化** | fragile な手順を fragile な自動化にしただけ。先に簡素化する                 |
| **サービス間の密結合**                 | デプロイ順序を厳密に決める必要 → 自律デプロイができない。疎結合に再設計する |
| **手動コンソール操作が残る**           | 「最後の最後」で人間オペレーション。再現性とスケールの両方を失う            |
| **開発と運用の不整合**                 | 自動化設計を片側だけで決めると現実とズレる。両者の協働が必要                |

## Deploy Time と Deployment Automation の違い

混同しやすいので明示:

| 概念                                  | 何                                    |
| ------------------------------------- | ------------------------------------- |
| **Deployment Automation** (DORA)      | 仕組み・能力の有無 (yes/no 寄り)      |
| **Deploy Time** (upflow / cycle time) | merged → released の所要時間 (連続値) |

Deployment Automation が成立しているか否かが、Deploy Time の上限を決める。Automation なし = Deploy Time の中央値が時間〜日単位、ある = 分単位。

## AI 時代の論点

### 自動化が必須化する閾値

- 1 日のデプロイ回数が一定を超えると、手動デプロイは物理的に持続不能
- AI で PR 数が +98% 増える → デプロイ頻度の自然増 → 自動化の必要性が「あったらいい」から「ないと回らない」に変わる

### Auto-merge との組み合わせ

- AI レビュー + マージキュー + 自動デプロイ で、PR open → 本番反映が「数分」になりうる
- リスク: 人間チェックの隙が減る → ロールバック手段を強化する必要

### Canary / Blue-Green の再評価

- AI 生成コードは「動くが文脈に合わない」リスクがある (DORA 2025)
- 段階的リリース (Canary、Feature Flag) で本番影響を限定する設計が、AI 時代に重みを増す

## 計測

DORA の計測項目:

- 手動デプロイステップの数 (継続的に減らす)
- 自動化率 (継続的に上げる)
- パイプラインの遅延・ボトルネック

加えて upflow が見られる範囲:

- Deploy Time の中央値・p90 ([../metrics/dora.md](../metrics/dora.md) の Lead Time の構成要素として)
- Deployment Frequency (週次・月次推移)

## upflow での扱い

- ✅ Fly.io への自動デプロイ: `.github/workflows/deploy.yml`
- ✅ main マージ → 自動 build → 自動デプロイの流れが確立
- ✅ 同じパッケージを Fly.io にデプロイ (環境差異は env vars のみ)
- ✅ デプロイスクリプトはバージョン管理 (`Dockerfile`, `fly.toml`, workflows)
- ✅ Deploy Time 計測: `pull_requests.deploy_time`
- ⚠️ オンデマンド自律性: GitHub Actions trigger は権限ある人なら可能だが、UI からのワンクリックデプロイ機能はない
- ❌ Blue-Green: なし (Fly.io rolling deploy のみ)
- ❌ Canary: なし
- ❌ Feature flag: インフラなし
- ❌ 自動ロールバック: なし (手動で revert PR を作る必要)
- ❌ Deployment Frequency 単独の指標化: 計測対象だが UI で可視化していない

特に **自動ロールバック** と **Feature flag** は AI 時代に PR 数が増えるほど重要性が増す。次の RDD 候補。

## 関連

- [continuous-delivery.md](./continuous-delivery.md) — Deployment Automation を含む umbrella
- [continuous-integration.md](./continuous-integration.md) — CI 生成パッケージを Deploy で使う
- [test-automation.md](./test-automation.md) — smoke test として Deployment 後の検証
- [../metrics/dora.md](../metrics/dora.md) — Deployment Frequency と Lead Time の指標

## 参考資料

- [DORA: Deployment Automation](https://dora.dev/capabilities/deployment-automation/) — 一次ソース
- [Continuous Delivery (Jez Humble & David Farley)](https://continuousdelivery.com/) — 書籍。デプロイ自動化の理論
- [Fly.io: Deploying with GitHub Actions](https://fly.io/docs/launch/continuous-deployment-with-github-actions/) — upflow 採用構成の参考
