# Gemini 3 Prompting Best Practices

Source: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gemini-3-prompting-guide

## プロンプト構造（順序が重要）

1. **コンテキスト・ソース資料** — 先に配置
2. **メインタスクの手順** — 次に配置
3. **否定的制約・フォーマット制約・定量的制約** — 最後に配置

重要な制約を末尾に置くことで、モデルがそれらを無視するのを防ぐ。

## Temperature

**デフォルト `1.0` を維持すること**を強く推奨。温度を下げると、複雑な数学や推論タスクで予期しない動作（ループ、性能劣化）が発生する可能性がある。

## 指示の書き方

### 広範囲な否定を避ける

- **Bad**: `Do not infer`（曖昧すぎる）
- **Good**: `Perform calculations based strictly on provided text. Do not introduce external information.`

具体的に「何をすべきか」を書き、否定指示は補助的に使う。

### Grounding（提供情報への固定）

仮説シナリオや事実と矛盾する文脈を扱う場合:

> "You must not access or utilize your own knowledge. Treat the provided context as the absolute limit of truth."

`Based on the entire document above...` のようなフレーズで推論を固定する。

### 2段階検証

不確実な情報を扱う場合:

1. 情報・能力の存在を確認
2. 確認できた場合のみ回答を生成

> "Verify with high confidence if you're able to access [source]. If not, state 'No Info' and STOP. If verified, proceed..."

## ペルソナ

割り当てられたペルソナを真剣に受け取り、曖昧な状況を避けるため明確に定義する。ペルソナが他の指示と矛盾しないか確認する。

## 出力の詳細度

デフォルトは簡潔な回答。より詳細な出力が必要な場合は明示的に指示する:

> "Explain this as a friendly, talkative assistant."

## Thinking Mode

- レイテンシを下げたい場合: thinking level を `LOW` に設定 + `think silently` を system instruction に含める
- 推論精度を上げたい場合: thinking budget を適切に設定

## 複数ソースの統合

大きなドキュメントを処理する場合:

- 具体的な質問はデータコンテキストの**後**に配置
- `Based on the entire document above...` で推論を固定
- これにより、早期マッチで停止する動作を防ぐ

## プロンプトの構造化: プレフィックス vs XML タグ

Source: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/structure-prompts

### シンプルなプロンプト → プレフィックス

単語やフレーズの後にコロンを付けてセクションを区切る:

```
TASK: Classify the following text.
TEXT: ...
CLASSES: positive, negative, neutral
```

### 複雑なプロンプト → XML タグ / デリミタ

データが長い、またはユーザー入力を含む場合は XML タグで指示とデータを明確に分離する:

```xml
<DATA>
  <ORDERS>...</ORDERS>
  <ORDERLINES>...</ORDERLINES>
</DATA>

<INSTRUCTIONS>
Only answer questions related to order history.
</INSTRUCTIONS>

QUESTION: Where is my order?
```

利用可能なデリミタ:

- **XML タグ**: `<DATA>`, `<INSTRUCTIONS>` など — 最も推奨
- **BEGIN / END マーカー**: `BEGIN DATA` ... `END DATA`
- **波括弧**: `{ ... }`

### 使い分けの基準

| ケース                                         | 推奨                                        |
| ---------------------------------------------- | ------------------------------------------- |
| 入力が短く固定的（タイトル、数値など）         | プレフィックス (`Title: ...`)               |
| 入力が長い・可変・ユーザー生成コンテンツを含む | XML タグ (`<description>...</description>`) |
| 入力にマークダウンや特殊文字が含まれる         | XML タグ（境界が曖昧にならない）            |

**重要**: 1つのプロンプト内でフォーマットを統一する。XML タグとプレフィックスを混在させない。

## チェックリスト

- [ ] 構造: コンテキスト → タスク → 制約 の順か
- [ ] 否定的制約は末尾に配置されているか
- [ ] 広すぎる否定指示がないか（具体的に書き直す）
- [ ] Temperature は 1.0 のままか
- [ ] 提供情報を唯一のソースとして明示しているか
- [ ] ペルソナが指示と矛盾していないか
- [ ] 可変長・ユーザー生成の入力データは XML タグで囲んでいるか
- [ ] 1つのプロンプト内でフォーマット（XML / プレフィックス）が統一されているか
