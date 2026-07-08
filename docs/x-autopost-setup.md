# X（旧Twitter）連携のセットアップ手順

新着の「街のトピックス」記事を、公式Xアカウントに自動ポストする仕組みの有効化手順です。
コード側（フォロー導線・自動ポストのワークフロー）は実装済みで、以下の3ステップで動き出します。

---

## 1. X公式アカウントを作る＆ハンドルを設定

1. X で浦安ぽーたるの公式アカウントを作成（例：ハンドル `urayasu_portal`）。
2. `hugo.yaml` の次の箇所に、@を除いたハンドルを入れて push：

```yaml
params:
  social:
    x: "urayasu_portal"   # ← 自分のハンドルに
```

→ これだけで全言語のフッターに「Xでフォロー / Follow on X …」の導線が出ます（自動ポストと無関係に、この時点で有効）。

---

## 2. X APIキーを取得（自動ポスト用）

1. [X Developer Portal](https://developer.x.com/) で開発者アカウントを作成（Freeプランで可。書き込みは月あたりの上限内なら無料）。
2. アプリを1つ作成し、**User authentication settings** で権限を **Read and Write** に設定。
3. 次の4つのキーを取得（**Access Token/Secret は "Read and Write" に設定した後で再生成**すること。権限変更前に発行したトークンは読み取り専用のまま）：
   - API Key（= Consumer Key）
   - API Key Secret（= Consumer Secret）
   - Access Token
   - Access Token Secret

---

## 3. GitHub Secrets に登録

リポジトリの **Settings → Secrets and variables → Actions → New repository secret** で、次の4つを登録：

| Secret 名 | 中身 |
|---|---|
| `X_APP_KEY` | API Key |
| `X_APP_SECRET` | API Key Secret |
| `X_ACCESS_TOKEN` | Access Token |
| `X_ACCESS_SECRET` | Access Token Secret |

---

## 動作

- **発火タイミング**：サイトのデプロイ（push、および毎朝の予約公開リビルド）が完了するたびに、`Auto-post new posts to X` ワークフローが走ります。
- **投稿対象**：公開済みの `/posts/`（街のトピックス日本語記事）のみ。1回あたり最大3件、古い順に投稿。
- **初回**：現在ある記事はすべて「既読」として記録し、**投稿は0件**（過去記事の一斉投稿を防止）。以降の新着から投稿されます。
- **安全設計**：Secrets が未設定の間は、ワークフローは何も投稿せず正常終了します（今この状態）。
- **状態管理**：投稿済み記事は `.github/x-posted.json` に記録され、ワークフローが `[skip ci]` 付きで自動コミットします（再デプロイは起きません）。

### 手動テスト

Secrets 登録後、**Actions タブ → Auto-post new posts to X → Run workflow** で手動実行できます。
初回は「既読化のみ・投稿0件」になります。動作確認として新規記事を1本公開すると、次のデプロイ後に自動投稿されます。

### 調整ポイント（任意）

- 1回の投稿件数：ワークフローの env に `X_MAX_PER_RUN`（既定3）を追加で変更可。
- ハッシュタグや文面：`scripts/x-autopost.mjs` の `HASHTAGS` / `buildText()` を編集。
