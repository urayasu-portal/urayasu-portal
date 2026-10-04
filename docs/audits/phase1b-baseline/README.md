# 工程1b 改修前後の比較データ

- 改修前: `4facd5fd`（作業開始時の `origin/main`。`phase05-baseline/after-2026-10-04/` と全ファイル一致を確認済み）
- 改修後: 工程1b の実装コミット（`65536cf3`）
- 生成条件: `git -c core.autocrlf=false archive` で展開し、Hugo 0.167.0（`--minify`・本番と同じ baseURL）でビルド。Pagefind 1.5.2 でインデックスを生成。
- スナップショット: `scripts/baseline/snapshot.mjs`（工程1b で `cards.tsv`・`jsonld.tsv` の出力を追加）

## ファイル

| ファイル | 内容 |
|---|---|
| `card-dates.tsv` | 記事カードに出る日付を、記事（リンク先）ごとに1行でまとめたもの。列: URL・カテゴリ（1件目）・`date`・`eventDate`・カードの表示日（改修前）・カードの表示日（改修後）・開催日ラベル（改修後）。1,116 記事（多言語の旅行ガイド等を含む） |
| `summary-before.json` / `summary-after.json` | スナップショットの件数（ページ・転送・サイトマップ・アフィリエイトリンク・カード・JSON-LD ブロックなど） |

`card-dates.tsv` は、同じ記事がどのページのカードでも同じ表示になることを確かめたうえで作成した（ページごとに表示が食い違う記事: 0件）。

## 全量データの再生成

カード単位の全量（`cards.tsv`、約 3.4MB・23,080 行）と全ページの SEO 一覧（`pages.tsv`）はリポジトリに入れていない。必要なときは `phase05-baseline/README.md` の手順でビルドし、`snapshot.mjs` を実行すると同じものができる。

```bash
node scripts/baseline/snapshot.mjs --public <before-pub> --hugo-list <before-list.csv> --hugo-log <before-build.log> --out <snap-before>
node scripts/baseline/snapshot.mjs --public <after-pub>  --hugo-list <after-list.csv>  --hugo-log <after-build.log>  --out <snap-after>
node scripts/baseline/compare.mjs <snap-before> <snap-after>
```

`cards.tsv` の列: ページ・ページ内の出現順・カードの種類（article-card / hero-main / hero-sub / list-feature-card / recent-item）・リンク先・カテゴリバッジ・サムネイル（img / ph）・代替表示のラベル・表示日（`datetime=表示`）・開催日ラベル。
`jsonld.tsv` は構造化データ1ブロックごとの内容の SHA-1。Event 構造化データが変わっていないことの確認に使う。
