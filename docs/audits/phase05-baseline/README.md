# 改修前の基準データ（工程0.5）

> **工程0.5 完了時点（衝突解消後）の基準データ**は [after-2026-10-04/](after-2026-10-04/) にある。工程1b 以降の「改修前」比較にはこちらを使う。
> 生成条件: 作業ブランチのコミットを `git -c core.autocrlf=false archive` で展開し、**Hugo 0.167.0（本番と同じ版）**でビルド。主要6ページで本番 HTML とバイト一致を確認済み（CSS のハッシュ名を除く）。
> 下記の表は工程0.5 着手前（`4c24564e`、ローカル Hugo 0.161.1）の値。

- 基準コミット: `4c24564e`（`origin/main`、2026-10-04 08:18 JST。本番と同一）
- 取得日: 2026-10-04
- 生成環境: ローカル Hugo v0.161.1 extended（Windows）。本番 CI は v0.167.0。両者の HTML 差は `<meta name="generator">` と JSON-LD `articleBody` 内の改行文字（Windows の CRLF 由来）だけだった（主要4ページで本番と照合）
- 生成スクリプト: `scripts/baseline/snapshot.mjs`、比較: `scripts/baseline/compare.mjs`

## ファイル

| ファイル | 内容 | 件数 |
|---|---|---|
| `summary.json` | 件数のまとめ | — |
| `content-inventory.tsv` | content 配下の全 .md: パス・言語・種別・**Hugo が生成する URL**・タイトル・slug・date・lastmod・カテゴリ・eventDate・draft | 1,208 |
| `affiliate-links.tsv` | 生成 HTML 内の予約・アフィリエイトリンク（ページ・ASP・URL＝パラメータ込み・rel） | 721 |
| `aliases.tsv` | 旧 URL の転送ページ（パス→転送先） | 1,511 |
| `sitemap-urls.txt` | 言語別サイトマップの URL | 1,462 |
| `key-pages.tsv` | 主要40ページの title・canonical・robots・hreflang・構造化データの種類・h1数 | 40 |
| `duplicate-paths.txt` | Hugo の重複出力パス警告 | 44 |
| `build-warnings.txt` | Hugo の WARN | 4 |
| `hugo-version.txt` | 取得に使った Hugo | — |

ASP 別のリンク数（ページ×URL の組）: Trip.com 194・Booking.com 180・Agoda 176・A8 59・Expedia 45・楽天 43・Travelpayouts 18（KKday／Klook）・じゃらん 3・アソビュー 3。
認証情報・トークンは含まない（公開 HTML とリポジトリの内容だけから作成）。

## 全ページの SEO 一覧（pages.tsv）について

全 2,919 ページ分の `pages.tsv`（約 0.9MB）はリポジトリに入れていない。必要なときは基準コミットから再生成する:

```bash
mkdir -p /tmp/base && git archive 4c24564e | tar -x -C /tmp/base
rmdir /tmp/base/themes/PaperMod && cp -r themes/PaperMod /tmp/base/themes/
cd /tmp/base
hugo list all > /tmp/base-list.csv
HUGO_ENVIRONMENT=production hugo --minify --baseURL "https://urayasu-portal.com/" \
  --destination /tmp/base-pub --printPathWarnings > /tmp/base-build.log 2>&1
cd -   # リポジトリに戻る（snapshot.mjs は現在のリポジトリの post-rules.js を使う）
node scripts/baseline/snapshot.mjs --public /tmp/base-pub --hugo-list /tmp/base-list.csv \
  --hugo-log /tmp/base-build.log --out /tmp/snap-base
```

改修後も同じ手順でスナップショットを作り、`node scripts/baseline/compare.mjs /tmp/snap-base /tmp/snap-after` で比較する。

## 比較時の注意（既知の揺らぎ）

同じソースを2回ビルドしても、次のページは表題や robots が入れ替わることがある（同じ URL になる別表記のタグがあるため。`docs/audits/phase05-slug-collision-plan.md` の T02・T03）。差分に出ても改修の影響ではない:

- `/tags/jcom浦安音楽ホール/`（J:COM／JCOM）
- `/tags/ブリオベッカ浦安市川/`（「・」の有無。index／noindex も入れ替わる）
- `/en/tags/rainy-day/`（Rainy Day／rainy-day）。この表題を表示する en の旅行ガイド3ページも同様
