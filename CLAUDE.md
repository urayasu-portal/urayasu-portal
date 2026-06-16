# 浦安ぽーたる — Claude Code 運用ルール

## 記事更新時の必須作業

記事内容（本文・FAQ・画像・リンクなど）を変更した際は、**必ず** frontmatter の `lastmod` を作業当日の日付に更新すること。

```yaml
lastmod: YYYY-MM-DD  # 例: 2026-06-13
```

- `date`（初回公開日）は変更しない
- `lastmod` だけを更新する
- 複数ファイルを同一コミットで変更した場合、変更した全ファイルの `lastmod` を更新する

## ビルド & デプロイ

```powershell
cd C:\Users\kadoh\OneDrive\Desktop\urayasu-portal
hugo --minify
git add -A
git commit -m "メッセージ"
git push origin main
```

GitHub Actions が自動で GitHub Pages にデプロイする。

## ファイル構成メモ

- 記事: `content/guides/*.md`
- ガイド一覧カード定義: `data/lifeguides.yaml`
- カスタム CSS: `assets/css/extended/custom.css`
- カスタム head（構造化データ・GA）: `layouts/partials/extend_head.html`
- FAQ JSON-LD partial: `layouts/partials/faq-jsonld.html`
- OG 画像（共通）: `static/images/og-guides.png`
- OG 画像（サイト全体デフォルト）: `static/images/og-default.png`

## 構造化データ

- `layouts/partials/faq-jsonld.html` が `faq:` frontmatter を FAQPage JSON-LD に変換する
- `extend_head.html` の末尾で呼び出し済み
- Google Search Console で "リッチリザルトテスト" を使って確認可能

## テーマ

PaperMod（git submodule: `themes/PaperMod`）。テーマファイルは直接編集しない。
og:image の優先順位: `cover.image` frontmatter → `images:` frontmatter → サイト全体デフォルト。

---

## 旅行ガイドセクション 永続ルール

### サイト構造

```
/travel-guide/                        ← セクションハブ（layouts/travel-guide/list.html）
/travel-guide/hotels/                 ← ホテルハブ（layouts/travel-guide/hotels/list.html）
/travel-guide/hotels/{slug}/          ← 個別ホテルページ（layouts/single.html）
/travel-guide/hotels/kids/            ← 柱記事：子連れ向け
/travel-guide/hotels/budget/          ← 柱記事：格安
/travel-guide/hotels/access/          ← 柱記事：アクセス比較
```

ホテルデータは `data/hotels.yaml`。Hugo テンプレートから `hugo.Data.hotels` でアクセス。

### コンテンツ 3層モデル

1. **ハブページ**（`_index.md`）: エリア早わかり・価格帯ピラミッド・全施設一覧
2. **柱記事**（テーマ別比較記事）: シーン別（子連れ/格安/アクセス）の横断比較
3. **個別施設ページ**（`{slug}.md`）: 基本情報・おすすめ/向かない人・アクセス・設備・地元メモ

### ファッションホテル 3軒の掲載ポリシー（永続ルール）

以下 3 施設は **名称・エリア・カテゴリのみ** を一覧表に掲載する。

| 施設名 | 理由 |
|---|---|
| M4 design hotel | ファッションホテル |
| ホテルリバーサイド東京ベイ | ファッションホテル |
| ホテルダイヤモンド | ファッションホテル |

- 個別ページを作らない
- アフィリエイトリンクを設置しない
- 価格・特徴メモ・写真を掲載しない
- `data/hotels.yaml` では `policy: name-only` / `individual_page: false` を維持すること
- 一覧表では `※` マークを付け、ページ末尾に「※ 印の施設は名称・エリア・カテゴリのみ掲載しています。」と注記する

### 記事フォーマットルール

- 旅行ガイド記事はエバーグリーンコンテンツ扱い。frontmatter に `noDate: true` を設定し日付を非表示にする
- 「要調査」「未確認」などの文言は本文に掲載しない（内部メモのみ）
- 個別施設ページには必ず「おすすめしない人」セクションを設ける（公平な評価を維持するため）
- 価格情報は「2名1室・通常期の目安」と明示し、繁忙期の変動を注記する

### デザインポリシー

- CSS クラスは `.tg-*` プレフィックスを使用（既存の `.lg-*` / `.portal-*` と混在しない）
- 既存テーマデザインが最優先。モックアップと乖離がある場合はテーマに合わせる
- OGP 画像: `/images/og-travel-urayasu.png`（1200×630）

### データソース管理

- ホテル情報の追加・更新は `data/hotels.yaml` で一元管理
- 新規ホテル追加時は `policy: normal` または `policy: name-only` を必ず設定する
- `individual_page: true` かつ `slug:` を指定したホテルのみ個別ページを作成する
- アフィリエイトリンクが整備されるまでは予約リンク不要（プレースホルダー非表示で可）
