# X（旧Twitter）連携のセットアップ手順

新着の「街のトピックス」記事を、公式Xアカウントに自動ポストする仕組みの有効化手順です。
コード側（フォロー導線・自動ポストのワークフロー）は実装済みで、以下の3ステップで動き出します。

> ## ⏸ 自動ポストは休眠中（2026-07-09判断）
>
> X APIが pay-per-use（従量課金）化し、**URL付き投稿は $0.20/件**（[X公式料金](https://docs.x.com/x-api/getting-started/pricing)）。
> 地元向けトピックス記事の投稿頻度だと月数千円規模の固定費になる一方、フォロワー層（地元読者）と
> 本サイトのアフィリ収益源（観光ガイド＝訪日旅行者向け）が一致せず、費用対効果が低いと判断。
> `.github/workflows/x-autopost.yml` の `workflow_run` トリガーをコメントアウトし、
> 手動実行（`workflow_dispatch`）のみに変更済み。X公式アカウント作成・APIキー取得・Secrets登録
> （下記1〜3）は完了済みで、いつでも手動実行や自動化の再開ができる状態。
> フォロー導線（フッターの「Xでフォロー」）は無料機能なので稼働中のまま。
>
> 再開する条件の目安：①X側の料金体系が変わる ②地元スポンサー広告等でフォロワー数が営業材料になる
> ③ハッシュタグ等でトピックス記事自体の収益化ができる、のいずれか。

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

- **発火タイミング**：本来はサイトのデプロイ完了ごとに自動発火する設計だが、現在は休眠中のため**手動実行（Actions タブ → Run workflow）のみ**。自動発火を戻すには `x-autopost.yml` の `workflow_run:` ブロックのコメントを外す。
- **投稿対象**：公開済みの `/posts/`（街のトピックス日本語記事）のみ。1回あたり最大3件、古い順に投稿。
- **初回**：**最新1件だけ投稿**し、残りの記事は「既読」として記録します（過去記事の一斉投稿を防ぎつつ、キーが正しく動くかの確認を兼ねる）。以降は新着のみ投稿。
- **安全設計**：Secrets が未設定の間は、ワークフローは何も投稿せず正常終了します（今この状態）。
- **状態管理**：投稿済み記事は `.github/x-posted.json` に記録され、ワークフローが `[skip ci]` 付きで自動コミットします（再デプロイは起きません）。

### 手動テスト

Secrets 登録後、**Actions タブ → Auto-post new posts to X → Run workflow** で手動実行できます。
初回は**最新1件を実際に投稿**するので、公式アカウントのタイムラインに出れば成功です（キーが正しく動いている証拠）。以降は新着記事が自動で流れます。

### 調整ポイント（任意）

- 1回の投稿件数：ワークフローの env に `X_MAX_PER_RUN`（既定3）を追加で変更可。
- ハッシュタグや文面：`scripts/x-autopost.mjs` の `HASHTAGS` / `buildText()` を編集。
