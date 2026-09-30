# 浦安ぽーたる 工程0 現状調査報告書

- 調査日: 2026-10-04
- 調査者: Claude Code（Claude Opus 5.5）
- 調査方法: ソースコード静的調査 ＋ 調査用コピーでの Hugo ビルド ＋ 本番サイトへの読み取り専用 HTTP リクエスト ＋ アプリ内ブラウザでの実画面確認（PC幅・スマホ幅 375px）
- 本書の位置づけ: 改修は一切行っていない。次工程「全体工程表の策定」の技術資料として、単独で読める形にまとめた。

> **確認状況の表記**
> - **確認済み** … コード・設定・ビルド成果物・本番レスポンス・実画面のいずれかで事実を確認したもの
> - **要検証** … 問題の可能性はあるが、根拠が十分でないもの
> - **未確認** … 権限・環境・外部データの不足で調査できなかったもの

> **コード参照について**
> 本書の `ファイルパス:行番号` は、**本番と同一の `origin/main`（コミット `4c24564e`、2026-10-04 08:18 JST）** の行番号である。ローカル作業ツリーは別ブランチ（第2章 2.7 参照）のため、行番号がずれる可能性がある。

---

## 第1章 エグゼクティブサマリー

### 1.1 調査範囲

| 区分 | 範囲 |
|---|---|
| コード | `origin/main` 全体（Hugo 設定・`layouts/`・`data/`・`content/`・`scripts/`・`static/tools`・`.github/workflows`・`docs/`） |
| ビルド | `git archive origin/main` で一時ディレクトリへ展開し、本番 CI と同じ `hugo --minify`（`--buildFuture` なし）を実行。**リポジトリ内には何も生成していない** |
| 本番 | `https://urayasu-portal.com/` へ GET/HEAD のみ（ログイン・送信・巡回なし）。DNS 照会 |
| 実画面 | アプリ内ブラウザでトップ・イベントカレンダー・カテゴリ・子育てガイドを表示。PC幅（1280px）とスマホ幅（375×812）で DOM 位置を計測 |
| 対象外 | GA4・Search Console・AdSense・各 ASP 管理画面（アクセス権なし）、Cloudflare 管理画面、GitHub リポジトリ設定 |

### 1.2 全体的な所見

技術基盤は **Hugo（静的サイト）＋ PaperMod テーマの大幅オーバーライド ＋ GitHub Pages** で、シンプルで壊れにくい。ホテル情報は CSV マスター → PowerShell → `data/*.yaml` で一元化されている。多言語（5言語）の hreflang・canonical、構造化データ、アフィリエイトのクリック計測など、土台はかなり作り込まれている。2026-09 には SEO 技術監査（`docs/seo/01-technical-audit.md`）も実施済みである。

一方で、**日々の posts 運用で使う frontmatter の意味が曖昧なまま増築されてきた**ことが、診断で指摘された問題の大半の根本原因である。中でも `eventDate` が「イベント開催日」「告知の対象日」「開店日」「試合日」を兼ねている。また posts は別環境（記事化プロンプト＋投稿ツール）から投入されるため、**ビルド側にデータ検証の関門がない**。

### 1.3 確認された重要な問題（上位）

| # | 問題 | 確認状況 |
|---|---|---|
| 1 | **slug の重複で 10 記事が本番から消えている**。同じ slug の続報記事が旧記事の URL を上書きしている。一覧とカレンダーには同じ URL のカードが2枚並ぶ | 確認済み（ビルド警告＋本番 title 照合） |
| 2 | **記事カードが公開日の代わりに `eventDate` を表示**している。生文字列（`2026-11-19`、`2026-10-23/2026-10-31`）のまま出るうえ、同じ一覧内で公開日表示のカードと混在する | 確認済み |
| 3 | **`eventDate` さえあれば、カテゴリを問わずイベントカレンダーと Event 構造化データに載る**。「イベント」以外の 224 記事が該当（例: テレビ受信障害のお知らせが Event として出力され、主催者は既定値の「浦安市」） | 確認済み |
| 4 | **ホテル比較ページ5種（ハブ・子連れ・格安・アクセス・比較マップ）に予約リンクが0本**（5言語すべて）。予約ボタンは個別ホテルページにしかない | 確認済み |
| 5 | **開店・閉店年表の自動分類が誤分類する**。「一時休業」「臨時休業」→リニューアル／閉店、「出店予定か（求人で判明）」→オープン、「営業再開」→リニューアル。種別の語彙自体も足りない | 確認済み |
| 6 | イベントカレンダーが**記事単位**で、同じイベントの複数記事が別行で並ぶ。イベント ID がない | 確認済み |
| 7 | 「イベント　イベント」の二重表示。原因は、画像のない記事のサムネイル代替表示（ラベル）とカテゴリバッジが同じ語を並べること | 確認済み |
| 8 | 投稿ツールの検証に穴がある: slug・date の必須チェック、date の未来日チェック、**既存 slug との重複チェックがない** | 確認済み |
| 9 | AdSense 自動広告のスロットが**子育てガイドにも挿入**されている。CLAUDE.md の「子育て・介護・急病・防災には広告を置かない」方針と矛盾する可能性 | スロット挿入は確認済み・実配信は要検証 |
| 10 | CI の Hugo バージョンが `latest` 固定で、廃止予定 API の警告が4件出ている。将来の Hugo 更新でビルドが止まるリスク | 確認済み |

### 1.4 今後の改修における技術的な留意点

- **posts の frontmatter は外部の記事化プロンプトと投稿ツールが生成する**。データ構造を変えるときは、テンプレート・既存記事・プロンプト・投稿ツールの4点を同時に揃える必要がある。旧形式も読み続ける後方互換を必ず残すこと。
- **URL は維持が最優先**。slug なし記事（176件）は日本語ファイル名から URL が決まっている。ファイル名の変更も URL 変更になる。
- 予約ボタンは `layouts/partials/hotel-book-buttons.html` が単一ソースで、比較表は `layouts/partials/hotel-compare-table.html` が単一ソース。この2つを組み合わせれば比較ページへの予約導線は**新規コンポーネントなしで実装できる**。
- カテゴリ → CSS クラスの辞書が 8 テンプレート以上に重複している。表示ロジックの共通化は工程1・4で同時に効く。
- Cloudflare は **DNS のみ（プロキシ無効）**。キャッシュ・リダイレクト・ヘッダー制御は GitHub Pages の制約内でしかできない。

### 1.5 追加の確認が必要な事項（詳細は第9章）

記事化プロンプトの現行版、各 ASP の提携・承認状況（Agoda cid・Travelpayouts の p 値・VC LinkSwitch の対象広告主）、AdSense 自動広告の除外設定、GA4／GSC のアクセス権とカスタムディメンション登録状況、Cloudflare の権限と方針、slug 衝突で消えた記事の扱い。

---

## 第2章 技術スタック・プロジェクト構造

### 2.1 使用技術

| 区分 | 内容 | 根拠 |
|---|---|---|
| SSG | Hugo extended（ローカル v0.161.1 / CI は `latest`） | `.github/workflows/hugo.yml:46` |
| テーマ | PaperMod（git submodule、`154d006` = v8.0-138）。**layouts をほぼ全面オーバーライド** | `.gitmodules`、`layouts/baseof.html` |
| 言語 | ja（既定・サブディレクトリなし）/ en / zh / zh-tw / ko | `hugo.yaml:6-46` |
| CSS | PaperMod コア CSS ＋ `assets/css/extended/custom.css`（178KB 単一ファイル）を Hugo Pipes で結合・fingerprint | `layouts/partials/head.html:57-85` |
| アイコン | Tabler Icons webfont（jsDelivr CDN） | `layouts/partials/extend_head.html:14` |
| 検索 | ① Pagefind（CI で生成、サイドバー）② PaperMod Fuse.js（`/search/`、`index.json`）の **2系統** | `hugo.yml:61`、`sidebar-calendar.html:2`、`hugo.yaml:192-202` |
| JS | フレームワークなし。インライン JS（カレンダー・計測・地図）のみ | — |
| パッケージ管理 | **なし**（package.json / lock ファイル無し）。CI で `npx pagefind` を都度取得 | `hugo.yml:61` |
| データ生成 | PowerShell スクリプト（CSV → YAML） | `scripts/build-all.ps1` |
| ホスティング | GitHub Pages（Fastly）。Cloudflare は DNS のみ | 本番レスポンスヘッダー `Server: GitHub.com`、A レコード 185.199.108-111.153、NS `*.ns.cloudflare.com` |
| 外部スクリプト | GA4 gtag、AdSense、ValueCommerce LinkSwitch、Travelpayouts Drive（emrld.ltd）、Tabler CSS | `extend_head.html` |

> 事前情報の「Cloudflare を利用」は **DNS 管理のみ**と判明した。Cloudflare 経由の配信ヘッダー（`cf-ray` 等）は無く、プロキシは無効（グレークラウド）と判断できる。**確認済み**（ヘッダー・DNS）。管理画面の設定内容は**未確認**。

### 2.2 ディレクトリ構造（主要部）

```
urayasu-portal/
├─ hugo.yaml                  サイト設定（言語・アフィリID・メニュー・検索）
├─ .github/workflows/
│   ├─ hugo.yml               ビルド＆GitHub Pages デプロイ（push / schedule 3回 / 手動）
│   └─ x-autopost.yml         X 自動投稿（休眠中・手動のみ）
├─ .githooks/pre-commit       姉妹サイト記事の誤混入検出（ローカルのみ有効）
├─ archetypes/default.md
├─ assets/css/extended/custom.css   独自デザイン全体（178KB）
├─ content/
│   ├─ posts/                 街のトピックス（ja 737 / en 6 / zh-tw 6）
│   ├─ life-guide/            生活ガイド（ja 29 ＋ _index）
│   ├─ travel-guide/          旅行ガイド（ja 20 ＋ _index、他言語あり）
│   │   └─ hotels/            ホテル（ja 54 ＋ _index、他言語あり）
│   ├─ categories/・tags/     タクソノミーの説明用 _index
│   ├─ daily/                 日付別一覧（JS）
│   └─ events.md / open-close.md / search*.md / about・contact・privacy・thanks
├─ data/
│   ├─ hotels.yaml            ★自動生成（一覧・比較表用）
│   ├─ hotels_map.yaml        ★自動生成（座標・設備・予約URL）
│   ├─ facilities.yaml / hotel_survival.yaml  ★自動生成
│   ├─ openclose.yaml         開店閉店年表の手動キュレーション（61件）
│   ├─ guide_map.yaml         posts タグ → 生活ガイド対応表
│   ├─ affiliate_ctas.yaml    記事末尾 CTA の定義
│   ├─ lifeguides.yaml / taggroups.yaml
│   └─ travel_facts.yaml / life_facts.yaml   料金・時刻などの定数（fact ショートコード）
├─ hotel-database-full.csv    ★ホテル情報の唯一のマスター（48軒×63列）
├─ facility-database.csv / life-guide-database.csv
├─ i18n/{ja,en,zh,zh-tw,ko}.yaml
├─ layouts/                   ※PaperMod を上書きする独自テンプレート群（2.4節）
├─ scripts/                   CSV→YAML 生成・各種チェック（PowerShell）
├─ static/
│   ├─ images/                画像 166 ファイル・28MB（Hugo 画像処理は未使用）
│   ├─ admin/                 Decap CMS 設定（Netlify Identity 前提）
│   ├─ tools/post-tool.html   記事投稿ツール（GitHub API 直書き込み）
│   ├─ robots.txt / ads.txt
├─ docs/                      設計・監査・運用記録（redesign/・redesign-life/・seo/・maintenance-log.md 他）
└─ themes/PaperMod            submodule
```

### 2.3 ページ生成方式・ルーティング

- 完全静的生成（SSG）。ルーティングは Hugo の**ディレクトリ＝URL**方式。posts は `slug:` があれば `/posts/<slug>/`、無ければファイル名から決まる。`url:` を明示した記事が1件ある
- 日本語はルート直下、他言語は `/en/` `/zh/` `/zh-tw/` `/ko/`（`defaultContentLanguageInSubdir: false`）
- 非日本語のトップ（`/en/` 等）は `/xx/travel-guide/` へ meta refresh＋JS で転送する中継ページ（`layouts/index.html:2-10`）
- 旧URL維持は Hugo `aliases`（meta refresh＋canonical の HTML を生成）。サーバー側 301 は使えない（GitHub Pages のため）

### 2.4 共通レイアウト・主要テンプレート

| ファイル | 役割 |
|---|---|
| `layouts/baseof.html` | 全ページ骨格。`<body class="pillar-*">`、ヘッダー、柱スイッチャー（ja）／旅行サブナビ（非ja）、フッター |
| `layouts/partials/header.html` | ロゴ・検索リンク・言語ドロップダウン。**`hugo.yaml` の `menu.main` は描画していない**（未使用設定） |
| `layouts/partials/pillar-switcher.html` | 「街のトピックス／生活ガイド／旅行ガイド」の3タブ（ja 全ページ） |
| `layouts/partials/footer.html` | カテゴリ・ガイド・規約リンク |
| `layouts/index.html` | トップ（ja ＝ 地域ポータル。en/zh/zh-tw/ko の旧 LP は未使用コード） |
| `layouts/posts/list.html` | `/posts/` 一覧 |
| `layouts/list.html` | カテゴリ・タグ・その他のリスト |
| `layouts/single.html` | posts 等の詳細（目次・本文中 CTA・関連記事・サイドバー） |
| `layouts/travel-guide/*`, `layouts/travel-guide/hotels/*`, `layouts/life-guide/*` | 旅行・ホテル・生活ガイド専用 |
| `layouts/_default/events.html` / `openclose.html` | イベントカレンダー / 開店閉店年表 |
| `layouts/partials/article-card.html`, `article-thumb.html`, `cover-image.html` | 記事カード・サムネイル・カバー画像解決（**一覧表示の共通部品**） |
| `layouts/partials/head.html`, `extend_head.html`, `templates/schema_json.html`, `templates/opengraph.html` | メタ情報・構造化データ・外部スクリプト |
| `layouts/partials/hotel-book-buttons.html`, `tp-link.html`, `hotel-compare-table.html` | 予約ボタン・アフィリエイトリンク生成・ホテル比較表 |
| `layouts/partials/affiliate-tracking.html` | GA4 へのクリックイベント送信 |
| `layouts/partials/sidebar-calendar.html`, `sidebar-cat-counts.html` | サイドバー（検索＋カレンダー＋カテゴリ件数） |

**複数ページ共通の情報の所在**: サイト設定・アフィリ ID は `hugo.yaml`。ホテル情報は CSV → `data/hotels*.yaml`。事実定数は `data/*_facts.yaml`。カテゴリ表示（色・アイコン・説明文）は**各テンプレートに直書きの辞書**（`article-card.html:6-17`、`article-thumb.html`、`index.html`、`list.html:3-36`、`posts/list.html:3-14`、`single.html:3-23`、`breadcrumbs.html:6-17`、`cover-image.html`、`daily/list.html`）。

### 2.5 コンテンツ管理方式

- Markdown＋YAML frontmatter（本文は HTML 直書きが多く、`goldmark.renderer.unsafe: true`）
- データベース・ヘッドレス CMS は無し。`static/admin/`（Decap CMS）は GitHub backend＋Netlify Identity の設定だが、GitHub Pages 上では Netlify Identity が機能しない構成で、**実運用されているかは要検証**
- posts の主投稿経路は **`/tools/post-tool.html`（GitHub Contents API で main に直接コミット）**。コミット履歴でも、9/4 以降の main への 184 コミットが `feat: <タイトル>` 形式だった

### 2.6 ビルド・デプロイ・環境

| 項目 | 内容 |
|---|---|
| 本番反映 | `main` への push で `hugo.yml` が実行される（Hugo build → Pagefind → CNAME → GitHub Pages）。保険の schedule（UTC 13:23 / 14:47 / 16:38）と手動実行あり |
| 予約投稿 | `--buildFuture` なし。未来 `date` の記事はその時刻以降のビルドで公開 |
| 環境区別 | `HUGO_ENVIRONMENT=production`＋`params.env: production`（`hugo.yaml:52`）。**hugo.yaml に `env: production` が固定されているため、ローカルの `hugo server` でも GA・AdSense・LinkSwitch・計測 JS が出力される**（`head.html:12`、`affiliate-tracking.html:11`）**要検証**（ローカルでの誤計測の有無） |
| プレビュー環境 | なし（PR プレビュー・ステージングなし）。ローカル `hugo server` のみ |
| キャッシュ | 全リソース `Cache-Control: max-age=600`（GitHub Pages 固定）。fingerprint 付き CSS も 10 分 |
| 本番の最終ビルド | `Last-Modified: Sat, 03 Oct 2026 23:25 GMT`（= 10/4 08:25 JST）。`origin/main` 最新コミットと一致 |

### 2.7 Git の状態（調査開始時点・変更なし）

| 項目 | 状態 |
|---|---|
| 作業ブランチ | `claude/urayasu-station-bus-guide-vwsd3q`（HEAD `d243c037`） |
| main との関係 | main より **2 コミット先行**（バス乗り場ガイド関連）・**50 コミット遅れ**。ローカル `main` = `origin/main` = `4c24564e` |
| 未追跡ファイル | `AGENTS.md`、`output/imagegen/urayasu-station-bus-stops-20261001{.png,-prompt.txt}` |
| stash | 5件（`stash@{0}` は「session-concurrent edits … not mine」） |
| バックアップタグ | `backup-2026-10-04-main`（= `4c24564e`）、`backup-2026-10-04-station-bus-guide`（= `cdf6d945`。現 HEAD より古い） |

→ 本調査は**本番と同一の `origin/main` を対象**とした。上記の未コミット・未追跡・stash には一切触れていない。

### 2.8 品質管理

| 項目 | 状態 |
|---|---|
| 自動テスト・型チェック・Lint | **なし** |
| CI 内の検証 | **なし**（ビルドが通れば公開） |
| 手動チェック用スクリプト | `scripts/check-internal-links.ps1`、`check-facilities.ps1`、`check-parking-fees.ps1`、`audit-hotel-pages.ps1` |
| pre-commit | `.githooks/pre-commit`（姉妹サイト記事の誤混入検出のみ）。投稿ツール経由のコミットには効かない |
| 投稿ツール側検証 | `static/tools/post-tool.html:793-833`（第3章 3.1） |

---

## 第3章 主要機能・データ管理方式

### 3.1 記事（posts）投稿のデータフロー

```
[外部] 記事化プロンプト（別環境）
   │ Markdown＋frontmatter を生成
   ▼
[ブラウザ] /tools/post-tool.html  ── 品質チェック（ブロック／警告）
   │ GitHub Contents API PUT（main へ直接コミット）
   ▼
GitHub main ──push──▶ Actions(hugo.yml) ──▶ GitHub Pages（数分）
```

**posts の frontmatter 項目の実使用状況**（ja＋翻訳 749 ファイル中の出現数）

| 項目 | 件数 | 用途 | 定義の所在 |
|---|---|---|---|
| `title` | 752 | 見出し・title | — |
| `date` | 749 | 公開日（全件 `YYYY-MM-DDTHH:MM:SS+09:00` 形式） | CLAUDE.md の運用ルール |
| `categories` | 737 | 1件目が表示カテゴリ | 投稿ツール `ALLOWED_CATEGORIES`（7種） |
| `description` | 582 | meta description | — |
| `draft` | 579 | 全件 `false` | 投稿ツールで必須 |
| `slug` | 573 | URL（**176件は未設定でファイル名由来**） | — |
| `tags` | 567 | タグ・関連記事・ガイド連携 | `data/guide_map.yaml` |
| `hideEventBox` | 479 | イベント情報ボックス非表示 | 投稿ツールで `eventDate` があれば**必須** |
| `eventDate` | 380 | **開催日／対象日（意味が混在）** | `events.html:2-6` のコメントのみ |
| `sources` / `checkDate` | 240 | 出典表示 | — |
| `cover` | 131 | 画像（82% の記事は画像なし） | `cover-image.html` |
| `eventDates` | 91 | サイドバーカレンダーの点灯日 | `sidebar-calendar.html` |
| `lastmod` | 50 | 更新日 | CLAUDE.md |
| `eventOngoing` | 3 | 終了通知の抑止 | `event-ended-notice.html` |
| `eventEndDate`・`eventLocation`・`eventFee`・`eventUrl`・`organizer`・`shopName`・`openDate` 等 | 0〜1 | テンプレートは対応済みだが**ほぼ未使用** | `single.html:72-110`、`event-jsonld.html` |

### 3.2 日付・分類の関係図

```
date ───────────▶ 並び順（全一覧）／ヒーロー・サイドバーの表示日／datePublished／サイドバー月件数
lastmod ────────▶ 「更新」バッジ／dateModified／sitemap lastmod
eventDate ──┬──▶ 記事カードの表示日（★公開日を置き換える）  article-card.html:26-30
            ├──▶ /events/ カレンダー（カテゴリ不問）           events.html:11-38
            ├──▶ Event JSON-LD（カテゴリ不問）               event-jsonld.html:13
            ├──▶ 「終了しました」「◯◯前に掲載した告知です」    event-ended-notice.html
            └──▶ サイドバーカレンダーの「注目の日」             sidebar-calendar.html:30-44
categories[0] ─▶ バッジ色・アイコン・サムネ代替ラベル・パンくず・関連記事・NewsArticle 判定
「開店・閉店」 ─▶ /open-close/ 年表 ─ data/openclose.yaml（61件）か、タイトル正規表現で自動分類
```

### 3.3 ホテル情報のデータフロー

```
hotel-database-full.csv（48軒×63列・唯一のマスター）
   │ scripts/build-all.ps1（PowerShell・手動実行）
   ├─▶ data/hotels.yaml       名称(5言語)・エリア・区分・価格目安・特徴・policy・slug
   ├─▶ data/hotels_map.yaml   座標・設備フラグ・price_min・booking{rakuten,agoda,tripcom,expedia}
   ├─▶ data/facilities.yaml   周辺施設
   └─▶ data/hotel_survival.yaml
            │
            ├─ hotel-compare-table.html ◀─ ハブ一覧 list.html / {{< hotel-table >}}
            ├─ compare.html（地図比較）
            ├─ featured-hotels.html
            └─ hotels/single.html ─▶ hotel-book-buttons.html ─▶ tp-link.html（Travelpayouts）
content/travel-guide/hotels/{slug}.{lang}.md … 本文・cover 画像・FAQ（手書き）
content/travel-guide/hotels/{kids,budget,access}.md … 柱記事（手書き Markdown・データ非連動）
```

### 3.4 イベント情報

独立したイベントデータは**存在しない**。`/events/` は posts（ja）のうち `eventDate` を持つ記事を、ビルド時に1記事＝1行で並べる（第4章 調査F）。

### 3.5 ナビゲーション

- ja: ヘッダー（ロゴ・検索・言語）＋**柱スイッチャー（3タブ）**＋フッター。グローバルナビに「イベント」「お問い合わせ」は無い（`menu.main` は未使用）
- 非ja: ヘッダー＋旅行サブナビ（`travel-subnav-en.html`）
- パンくず: 独自 `breadcrumbs.html`（表示）と `schema_json.html` の BreadcrumbList（構造化データ）が**別ロジック**

---

## 第4章 調査A〜Jの詳細結果

### 調査A：プロジェクト全体の構造・技術スタック

第2章に詳述。以下は問題点のみ。

**A-1. Hugo バージョン未固定と廃止予定 API**

| 項目 | 内容 |
|---|---|
| 現状 | CI は `hugo-version: latest`。ビルド時に廃止予定警告が4件（`.Language.LanguageDirection`・`.LanguageCode`・`.LanguageName`・`.Site.Data`） |
| 確認結果 | ローカル v0.161.1 では正常。将来のメジャー変更で本番ビルドが突然失敗しうる。`npx pagefind` も版未固定 |
| 根拠 | `.github/workflows/hugo.yml:46,61`、`layouts/baseof.html:8-12`、`layouts/partials/header.html:55,60`（ビルドログ） |
| 影響 | 運用（公開停止リスク）。記事投稿が止まる |
| 改修案 | Hugo を検証済みの版に固定し、廃止予定 API を置換。pagefind も版固定 |
| 確認状況 | 確認済み |

**A-2. カテゴリ表示辞書の重複定義**

| 項目 | 内容 |
|---|---|
| 現状 | カテゴリ → クラス・アイコン・ラベルの dict が9テンプレートに重複 |
| 根拠 | 2.4節末尾のファイル群 |
| 影響 | 分類体系の変更（工程1）・カード改修（工程4）のたびに複数箇所の同時修正が必要。漏れると表示不整合 |
| 改修案 | `data/categories.yaml` などに集約し、partial から参照 |
| 確認状況 | 確認済み |

**A-3. 本番フラグの固定**: `hugo.yaml:52` の `env: production` により、ローカルプレビューでも計測・広告タグが出力される（**要検証**: ローカル閲覧が GA に計上されている可能性）。

**A-4. 作業ブランチの乖離**: 2.7節のとおり。改修開始前にブランチの扱い（main への統合 or 破棄）を決める必要がある。

### 調査B：ページ構造・コンテンツ管理

**B-1. ページ種別と URL**

| 種別 | URL | 生成 | 件数（ja／全言語） |
|---|---|---|---|
| トップ | `/` | `layouts/index.html` | 1 |
| posts 詳細 | `/posts/<slug or ファイル名>/` | `single.html` | ja 737（en 6・zh-tw 6） |
| posts 一覧 | `/posts/`、`/posts/page/N/` | `posts/list.html`（12件/頁） | — |
| カテゴリ | `/categories/<名>/` | `list.html` | 7＋「生活ガイド」1 |
| タグ | `/tags/<名>/` | `list.html` | 多数（3件未満は noindex） |
| 日付別 | `/daily/?date=` | `daily/list.html`（JS） | 1 |
| イベント | `/events/` | `_default/events.html` | 1 |
| 開店閉店年表 | `/open-close/` | `_default/openclose.html` | 1 |
| 生活ガイド | `/life-guide/`、`/life-guide/<slug>/` | `life-guide/*` | 29 |
| 旅行ガイド | `/travel-guide/`、`/travel-guide/<slug>/` | `travel-guide/*` | ja 20（en 24・zh 23・zh-tw 25・ko 23） |
| ホテル | `/travel-guide/hotels/`、`/travel-guide/hotels/<slug>/` | `travel-guide/hotels/*` | ja 54（個別45＋柱・機能ページ9） |

- **集計基準**: `content/<dir>` 直下の `*.md`。`_index*.md` は除外。言語は `.en.md` 等のサフィックスで判定
- ビルド結果: ja 3,266 ページ（ページ送り・タクソノミー含む）、en 228 / zh 216 / zh-tw 235 / ko 216。エイリアス HTML 計 1,515
- サイトマップ URL 数: ja 1,071 / en 103 / zh 98 / zh-tw 107 / ko 97（sitemapindex 配下）

**B-2. 一覧・関連記事・内部リンク**

| 機能 | 実装 | 根拠 |
|---|---|---|
| 一覧の並び | Hugo 既定（`date` 降順）。全一覧で `date` 基準 | `posts/list.html:17`、`index.html:404` |
| 関連記事 | 共有タグ数×3＋同カテゴリ×1でスコア、上位6件 | `single.html:194-237` |
| 同エリア記事 | `area-posts.html` | `single.html:273` |
| ガイド導線 | `related-guide.html`（`guide_map.yaml`）＋`extend_post_content.html` の article-context | `single.html:176-178` |
| 前後記事 | PaperMod `post_nav_links` | `single.html:265-267` |
| 本文中 CTA | 2つ目の h2 直前などへ自動挿入 | `single.html:139-163` |

**B-3. 公開・非公開・削除**: `draft: true`（現存0件）、未来 `date`（予約投稿）、ファイル削除のみ。期限切れ（`expiryDate`）は未使用。noindex は `robotsNoIndex: true`（`head.html:14`）。

**B-4. 過去 URL の維持**: `aliases`（posts 2件・生活ガイド15件・旅行ガイド多数）。WordPress 時代の URL（`/?p=`、`/YYYY/MM/DD/…`、`/category/…`）は 404（本番確認済み）。WordPress 時代の URL 構造の資料は見当たらず、移行時のリダイレクト対応範囲は**未確認**。

**B-5. 多言語**: 翻訳はファイル名サフィックス（`kids.zh-tw.md`）で対応付け。posts の翻訳は6本ずつ。非ja トップは旅行ガイドへの中継ページ。

**B-6. 【問題】slug の重複による記事の消失（重要）**

| 項目 | 内容 |
|---|---|
| 現状 | 続報記事が旧記事と**同じ slug**で投稿され、Hugo が同じパスに書き出している（後勝ち・順序は保証されない） |
| 確認結果 | ビルド時の "Duplicate target paths" 警告で9グループを検出し、本番の `<title>` と照合した。**旧記事10本が本番で閲覧不能**: aloha-urayasu-2026（9/14版）、gyotoku-machibar-october-2026（9/23版）、nhk-symphony-urayasu-pre-event-2026（5/21版）、sheraton-thai-food-buffet-2026（ja 8/20版）、tds-bring-the-rhythm-2027（9/17版）、trial-seiyu-urayasu-open（6/9版・6/30版）、urayasu-u-center-festival-2026（8/21版）、usagi-tea-garden-gohoubi-marche-2026（8/21版）、`url:` 指定の旧記事と日本語ファイル名記事の衝突（`/posts/浦安万華郷跡地活用方針が決定/`） |
| 副作用 | 一覧・カテゴリ・関連記事・イベントカレンダーには**両方のカードが残り、同じ URL を指す**（本番カレンダーで sheraton と gyotoku の重複行を確認）。ja サイトマップに重複 `<loc>` が13件 |
| 根拠 | ビルドログ、`content/posts/20260609-…/20260630-…/20260715-trial-seiyu-urayasu-open.md` ほか、本番 `curl` の title |
| 影響 | SEO（被リンク・インデックス済み URL の内容差し替え）、UI（重複カード）、運用（書いた記事が出ない） |
| 改修案 | ①衝突の解消方針を決める（旧記事に別 slug を付けて復活させるか、続報に統合するか）②投稿ツールに既存 slug 照合を追加 ③CI で重複出力パスをエラー化（`hugo --printPathWarnings` の出力を検査） |
| 確認状況 | 確認済み |

**B-7. 同一コンテンツの二重管理**: `posts/20260628-urayasu-bus-kotsu.md` と `life-guide/urayasu-bus-kotsu.md` が同じ aliases（`/guides/urayasu-bus-kotsu/` ほか）を持ち、出力パスが衝突している。**確認済み**（ビルド警告）。

**B-8. カテゴリ term ページの出力衝突**: `content/categories/グルメカフェ/_index.md` と term「グルメ・カフェ」が同じ `/categories/グルメカフェ/` に出力される（開店閉店・子育て教育も同様）。現状は正しい表示（59件等）だが、Hugo の出力順に依存している。**確認済み**（ビルド警告）／影響は**要検証**。

### 調査C：記事の日付・分類・重複表示

#### C-① 日付の扱い

**C-1-a. 記事カードが公開日の代わりに eventDate を表示（診断で指摘された現象の原因）**

| 項目 | 内容 |
|---|---|
| 現状 | `article-card.html` は `eventDate` があれば `<time>` にその**生文字列**を出し、無ければ公開日（`2006年1月2日` 形式）を出す |
| 確認結果 | 例: `/posts/urayasu-tv-interference-november-2026/`（date 2026-10-03・カテゴリ「お知らせ」・eventDate 2026-11-19）は一覧グリッドで「2026-11-19」と表示される。範囲指定は「2026-10-23/2026-10-31」とそのまま出る。同じページでもヒーロー3枚・サイドバー・カテゴリ新着は公開日表示で、**同一一覧内で日付の意味と書式が混在**する |
| 根拠 | `layouts/partials/article-card.html:26-30`。公開日表示は `index.html` のヒーロー、`posts/list.html:55,67`、`list.html:140` |
| 影響範囲 | article-card を使う全箇所（トップのグリッド12件、`/posts/` 一覧、カテゴリ・タグ一覧、関連記事）。ja posts 366件が該当し、うち事前告知型は約273件 |
| 改修案 | カードの日付を公開日に統一し、イベント日は「開催: 11/19(木)」など**別ラベル**で併記する。日付書式は partial に集約 |
| 確認状況 | 確認済み（ビルド HTML・本番実画面） |

**C-1-b. 日付項目の定義とタイムゾーン**

| 項目 | 用途 | TZ 処理 |
|---|---|---|
| `date` | 公開日・並び順・datePublished・ヒーロー／サイドバー表示 | 全件 `+09:00` 付き。hugo.yaml に `timeZone` 設定はない |
| `lastmod` | 更新バッジ（`single.html:46-48`）・dateModified・sitemap | 日付のみ（`YYYY-MM-DD`）。`enableGitInfo` なし |
| `eventDate` | 3.2節の5用途 | `"YYYY-MM-DD"`／`"A/B"`／YAML 配列の3形式が混在（290 / 86 / 2、空2件） |
| `eventEndDate` | 終了日（テンプレート対応済み） | 未使用 |
| `eventDates` | サイドバーの点灯日のみ | — |

- `/events/` は「今日」を `now + 9h` で判定（CI が UTC のため）（`events.html:8`）
- 終了通知は `time $endDateStr`（UTC 0時解釈）＋1日で判定（`event-ended-notice.html:20-22`）。JST 09:00 に切り替わるため、境界で最大9時間ずれる。**確認済み（コード）**
- 「開催中」「終了」の判定は**ビルド時点で固定**。ビルドが走らない日は表示が古くなる（schedule は保険のみ）

**C-1-c. HTML メタ・構造化データの日付**

- BlogPosting/NewsArticle: `datePublished = .PublishDate`、`dateModified = .Lastmod`（`schema_json.html:138-139`）→ 公開日ベースで正しい
- Event JSON-LD: `startDate/endDate = eventDate`（日付のみ）（`event-jsonld.html:42-43`）
- sitemap: `lastmod`（`_default/sitemap.xml:15-17`）

**C-1-d. 公開日と実施日を分離する場合の影響範囲**

テンプレート: `article-card.html`、`events.html`、`event-jsonld.html`、`event-ended-notice.html`、`sidebar-calendar.html`、`single.html`（イベント情報ボックス）、`intl-topic-single.html`／`intl-topic-list.html`（翻訳版）。
データ: posts 380ファイル。外部: **記事化プロンプト・投稿ツールの必須項目ルール**（`hideEventBox` 必須化など）。
→ 新項目を追加する場合でも、**旧 `eventDate` を読み続ける後方互換**を残せば既存記事の一括書き換えは不要。

#### C-② 分類の問題

**C-2-a. 開店・閉店年表の誤分類**

| 項目 | 内容 |
|---|---|
| 現状 | `data/openclose.yaml`（61件）にキュレーション値があればそれを使い、無ければタイトル正規表現で判定: 移転 → `リニューアル｜改装｜再開｜新装` → `閉店｜休業` → `まとめ` → それ以外は **open** |
| 確認結果 | 非キュレーションの「開店・閉店」57件を同じ規則で判定し、次の誤分類を確認した: 「北栄の喫茶さくらが一時休業　年内リニューアル予定」→ リニューアル。「居酒屋 屋久島が臨時休業　再開は改めて案内」→ リニューアル。「ブールミッシュ、9月1日から一時休業」→ **閉店**。「ナナズグリーンティーが9月18日営業再開」→ リニューアル。「〜出店予定か　求人で判明」等の未確定情報12件 → **オープン**。種別の語彙（`open/close/renewal/move/feature`）に「一時休業」「営業再開」「開店予定」が存在せず、yaml のコメントでも `close（閉店・休業）`・`renewal（改装・再開）` と意図的に混同している |
| 根拠 | `layouts/_default/openclose.html:10,25-31`、`data/openclose.yaml:3`（コメント） |
| 影響 | 年表のバッジと**冒頭の年間件数**（`openclose.html:45-54`。オープン件数に予定・噂が含まれる）。ItemList 構造化データの name |
| 改修案 | 種別語彙の拡張（例: open / open_planned / close / temp_close / reopen / renewal / move / feature）。記事 frontmatter に `shopStatus` 等を持たせ、正規表現は後方互換のフォールバックに格下げ |
| 確認状況 | 確認済み |

**C-2-b. 現データ構造での区別可否**

- 開店・閉店・移転・リニューアルは `openclose.yaml` で区別できる
- 一時休業・営業再開・開店予定は、`type` 値の追加（テンプレートの `$typeLabel` と CSS `.oc-*` の追加）で区別可能。記事側の項目は無い
- posts の `categories` は記事1件につき実質1値（「開店・閉店」に休業・再開・予定がすべて入る）

**C-2-c. カテゴリ運用**

- 7カテゴリは投稿ツールで制限されている（`post-tool.html:792`）。ただしチェックはブロック形式（`- "…"`）の配列だけが対象で、インライン形式 `categories: ["…"]`（20件）は検証されない（`post-tool.html:799`）
- 「ニュース」だけが NewsArticle、他は BlogPosting（`schema_json.html:104`）

#### C-③ 重複表示の問題

**C-3-a. イベントカレンダーの重複**: 調査F-2参照（記事単位管理・イベント ID なし・slug 衝突）。

**C-3-b. 「イベント イベント」のカテゴリ名重複**

| 項目 | 内容 |
|---|---|
| 現状 | 画像のない記事（82%）は、サムネイル位置にカテゴリ色の代替表示（アイコン＋**カテゴリ名ラベル**）を出し、その直下のカードにも**カテゴリバッジ**を出す |
| 確認結果 | 本番 `/categories/イベント/` のテキスト抽出で「イベント／イベント／タイトル」の並びを確認。記事詳細でも代替カバー（`single.html:61-64`）とバッジ（`single.html:42`）が並ぶ |
| 根拠 | `layouts/partials/article-thumb.html:35`、`layouts/partials/article-card.html:23` |
| 影響 | 見た目の冗長、スクリーンリーダー・検索スニペット・テキスト抽出で同語反復 |
| 改修案 | 代替表示のラベルを `aria-hidden` にする、ラベルを外す、またはカード側でバッジを省略する |
| 確認状況 | 確認済み |

**C-3-c. トップ・一覧内の重複表示**: トップのサイドバー「最近の記事」（`index.html:563`、先頭5件）が、ヒーロー3件＋グリッド先頭2件と同じ記事。`/posts/` も同様（`posts/list.html:128`）。**確認済み**

#### C-④ Markdown 投稿との互換性

| 項目 | 内容 |
|---|---|
| 投稿ツールの解析 | `parseFrontmatter`（`post-tool.html:500-505`）が正規表現で `date`（先頭8桁）と `slug`（`[a-z0-9-]` のみ）を抽出し、ファイル名 `YYYYMMDD-slug.md` を自動生成 |
| ブロック条件（エラー） | `^---\n…\n---` で囲まれていない／カテゴリが許可外／`eventDate(s)` があるのに `hideEventBox: true` がない／`draft: false` がない（`post-tool.html:793-813`）。ファイル名が `YYYYMMDD-` で始まらない（`:845`） |
| 警告 | lastmod 有無、sources 移行漏れ、本文300字未満、空 alt、地図以外の iframe 等 |
| **検証されないもの** | `slug` 未設定、`date` 未設定・形式不正・**未来日時**（公開されない原因になる）、**既存 slug との重複**（B-6 の原因）、`title`、インライン形式のカテゴリ、`eventDate` の形式 |
| ブロックの原因候補 | 先頭 `---` の正規表現は BOM や CRLF に弱い。リポジトリの posts の **193ファイルが UTF-8 BOM 付き**（ビルドには影響しない）。過去にブロックされた原因が BOM/改行コードだったかは**要検証**（エラーメッセージが「--- で囲まれていません」の1種類で、原因を区別できない） |
| Hugo 側 | frontmatter のスキーマ検証はない。CI で検証しない |
| 互換性リスク | 新項目（例: `eventStart`）を必須にすると、①プロンプト未更新の記事がブロックされる ②旧形式の記事は表示されなくなる。**旧項目のフォールバック読み込み＋警告扱いから段階導入**が必要 |
| 確認状況 | ツールのコードは確認済み。外部の記事化プロンプトは**未確認**（リポジトリ外） |

### 調査D：ホテル情報・アフィリエイト・収益導線

対象 URL はすべて現存（`/travel-guide/hotels/`、`/kids/`、`/budget/`、`/access/`、`/tdl-hotel/`）。地図比較 `/travel-guide/hotels/compare/` もある。

**D-1. データソースの一元化**

| 項目 | 現状 | 根拠 |
|---|---|---|
| マスター | `hotel-database-full.csv`（48行×63列。名称・エリア・区分・住所・アクセス・設備・価格帯・最低価格・各予約URL・座標・slug・5言語名） | CSV ヘッダー |
| 生成物 | `data/hotels.yaml`（区分・価格目安・特徴・policy）、`data/hotels_map.yaml`（座標・設備・price_min・booking） | `scripts/build-hotels.ps1:1-25`、`build-all.ps1` |
| 件数 | 48軒（通常45・名称のみ3）、7エリア、個別ページ45 | `hotels.yaml` |
| 生成手順 | **手動**で `powershell -File scripts/build-all.ps1` → hugo。CI では再生成しない（CSV だけ更新して YAML を再生成し忘れると不整合） | `build-all.ps1` |
| 個別ページ本文 | `content/travel-guide/hotels/<slug>.<lang>.md`（手書き）。住所・電話は CSV マスターに統一済み（fact-check 第29回） | — |
| 柱記事（kids/budget/access） | **手書き Markdown**。ホテル名・価格・特徴を本文に直書き（`fact` ショートコードは一部のみ）。データと非連動 | `content/travel-guide/hotels/kids.md` 等 |

→ **一覧・比較表・地図・予約URLは共通データ、柱記事の本文は個別記述**。**確認済み**

**D-2. 価格情報**: 静的な参考価格（CSV「最低価格」→ `price_guide` "¥N〜"）。手動更新で、外部 API による動的取得はない。ハブの価格ピラミッド（¥20,000〜等）は**テンプレートに直書き**（`layouts/travel-guide/hotels/list.html:174-183`）。CLAUDE.md の「2名1室・通常期の目安」明記ルールが全ページで守られているかは**要検証**。

**D-3. 写真**: 個別ページは `cover.image`（`static/images/hotels/` 45枚、jpg）。比較表・ハブにホテル写真はない。Hugo の画像処理（リサイズ・WebP・srcset）は未使用。

**D-4. 予約リンクの生成（`hotel-book-buttons.html`）**

| 言語 | 表示する予約先（順） | 収益化の経路 |
|---|---|---|
| ja | 楽天トラベル（43/46軒にURL）／じゃらん・Yahoo!（データ0件のため実質非表示） | 楽天アフィリエイト直リンク（`hb.afl.rakuten.co.jp`） |
| en | Agoda → Booking.com → Trip.com | Agoda: `cid` 未設定・Travelpayouts `agodaP` 未設定 → **素URL**。Booking: `bookingP` 未設定 → **素URL（個別URLは0件で検索結果URL）**。Trip.com: 直接提携 `Allianceid/SID` 付与 |
| zh / zh-tw | Agoda → Trip.com → Booking.com | 同上（Trip.com は tw.trip.com 等に切替） |
| ko | Agoda → Booking → Trip.com → Expedia | Expedia は素URL |

- Agoda・Booking の素 URL は、ValueCommerce LinkSwitch（全ページで読み込み）が提携先ならクリック時にアフィリ化される設計（`hugo.yaml:62-65`、`extend_head.html:21-25`）。**実際に提携・変換されているかは未確認**（ASP 管理画面が必要）
- ja で Agoda・Trip.com のデータ（44軒）を持っているのに表示していない（`hotel-book-buttons.html:86-90`）
- Trip.com の Allianceid は 2026-07-07〜10-04 の約3か月誤設定（**全期間クリック0**、`hugo.yaml:79-80`）。10/4 に修正済み
- 予約ボタンには `rel="sponsored noopener"`・`target="_blank"` が付く

**D-5. 予約導線の配置**

| ページ | 予約ボタン数（ja / zh-tw / en / ko） | 根拠 |
|---|---|---|
| ハブ `/travel-guide/hotels/` | **0 / 0 / 0 / 0** | ビルド HTML の `class="lg-book-btn"` 計数 |
| 子連れ `/kids/`・格安 `/budget/`・アクセス `/access/` | **0**（全言語） | 同上 |
| 比較マップ `/compare/` | **0** | 同上 |
| 個別（例 `/tdl-hotel/`） | 5 / 11 / 11 / 14 | 本文前（モバイル）・サイドバー・モバイル固定バーの3箇所 |

→ **比較・選択段階のページから予約サイトへ直接出る導線がない**。比較ページから個別ページへの内部リンクは多数ある（ハブ53・子連れ29種）。**確認済み**

**D-6. 再利用性の評価**

| 部品 | 再利用性 | 備考 |
|---|---|---|
| `hotel-book-buttons.html` | **そのまま再利用可**。引数は `bk`（hotels_map の booking）・`lang`・`cur2`（hotels_map の該当ホテル） | slug をキーに hotels_map から引けば任意の場所に置ける |
| `hotel-compare-table.html` | **拡張で対応可**。zone・category・pick・limit のフィルターを持つデータ駆動の比較表。予約列の追加は `hotels.yaml`（表示）と `hotels_map.yaml`（booking）を slug で結合するだけ | `hotel-compare-table.html:1-15,110` |
| `{{< hotel-table >}}` | 柱記事の Markdown からも呼べる（現在1記事のみで使用） | `layouts/shortcodes/hotel-table.html` |
| 新規が要るもの | 柱記事内の「おすすめホテル」カード用ショートコード（写真＋価格目安＋予約ボタン＋個別ページリンク）。配置識別用の data 属性 | — |

**D-7. クリック計測**: GA4 イベント `affiliate_click`（asp・cta_pos・link_url・link_text・page_path・page_lang）（`affiliate-tracking.html:62-76`）。ただし**予約ボタンに `data-cta-pos`・`data-asp`・`data-aff` が付いていない**ため、同一ページ3箇所のどこから押されたか区別できない。LinkSwitch が href を書き換えると `asp` が `valuecommerce` に化ける（コメントで認識済み）。ホテルの識別は `page_path`（個別ページ）か `link_url` からの推定になり、**ホテル ID のパラメータはない**。

**D-8. 広告・PR 表記**: 予約ボタン直下に `i18n "includes_pr"`（`hotels/single.html:143,233`）。本文用 `{{< ad-disclosure >}}`（17記事で使用）。生活ガイドの affiliate-box（akippa 方式）。比較ページは予約リンクが無いので表記もない（導線を追加するなら表記も同時に必要）。

### 調査E：トップページ・ナビゲーション・UI/UX

> 実画面: アプリ内ブラウザで本番を表示し、PC幅（ビューポート 1280px）とスマホ幅（375×812）で DOM 位置を計測した。スクリーンショットは環境制約で部分的にしか取れず、評価は**計測値とソースに基づく**。

**E-1. トップの表示順と3領域への到達**

| 順 | 要素 | スマホでの縦位置(px) |
|---|---|---|
| 1 | ヘッダー＋**柱スイッチャー（3領域タブ）** | 88 |
| 2 | ヒーロー「浦安の、いまを知る。」＋カテゴリ6ボタン | 209〜 |
| 3 | 新着ヒーロー3枚 | 559 |
| 4 | 最新記事グリッド12枚 | 1,540 |
| 5 | **「3つの入口から探す」** | **5,630**（全高 8,870） |
| 6 | 生活・買い物マップ、情報提供CTA、まとめ | — |
| 7 | サイドバー（検索・カレンダー・カテゴリ件数・最近の記事・タグ） | 6,494〜（イベントカレンダーへのリンクは 7,392） |

- 3領域へは**柱スイッチャーで常時1タップ**で行ける（全 ja ページ上部）。ただしトップ本文の「3つの入口」はスマホで約7画面下にある。旅行・生活ガイドの中身（目的別カード等）はトップに出ない
- トップの h1 は「浦安の、いまを知る。」。ページの性格は「街のトピックス」のトップ
- 「イベント」はグローバルナビに無い（`menu.main` 未使用）。トップではサイドバー下部の1リンクだけ
- 横スクロールはない（`scrollWidth = 375`）。CLS は計測時 0
- **確認済み**（計測）／見やすさの主観評価は実施していない

**E-2. ヘッダー・モバイルメニュー**: ハンバーガーメニューはない。ヘッダーはロゴ・検索・言語のみで、ナビは柱スイッチャー（横3タブ）が担う。言語切替は `<details>` のドロップダウンで、翻訳があるページだけ表示（`header.html:50-64`）。

**E-3. パンくず**: 表示は `breadcrumbs.html`（posts は「ホーム › カテゴリ › タイトル」、28文字で切り詰め）。構造化データは `schema_json.html:41-101`（URL 階層ベース）。**2系統が別ロジック**のため、posts では表示（カテゴリ経由）と BreadcrumbList（`/posts/` 経由）の階層が異なる。**確認済み（コード）**

**E-4. 検索**: ヘッダーの「検索」は `/search/`（Fuse.js、`index.json` が **ja 2.38MB**）、サイドバーは Pagefind。UI と結果が2種類ある。

**E-5. アクセシビリティ（コードから判断できる範囲）**

- アイコンフォントは `aria-hidden="true"` が付いている。画像 alt は記事タイトル（前回監査で欠落0件）
- カード全体が `<a>` で、中に h3・p・time を含む（読み上げ時に冗長）
- サムネ代替ラベルとバッジの重複読み上げ（C-3-b）
- サイドバーカレンダーの日付セルは `<div onclick>` で、**キーボード操作不可・role なし**（`sidebar-calendar.html:100`）
- スマホ幅で高さ24px未満のリンク・ボタンが18個（タップ領域の目安を下回る可能性。**要検証**）
- コントラストは未測定（**未確認**）

**E-6. 再利用可能な UI 部品**: `article-card`・`article-thumb`・`cover-image`・`meta-badges`・`breadcrumbs`・`hotel-compare-table`・`hotel-book-buttons`・`featured-hotels`・`topic-cta`・`related-guide(s)`・`pillar-switcher`。

**E-7. レイアウト変更の技術的制約**

- CSS は 178KB の単一ファイル（`custom.css`）で、命名は `.portal-*`・`.lg-*`・`.tg-*`・`.hcm-*` などが混在する。CLAUDE.md で `.tg-*` プレフィックスなどの規約あり
- PaperMod のコア CSS も読み込むため、上書きの影響範囲が読みにくい
- ダークモードは無効化済み（`hugo.yaml:135-136`）
- `index.html` には非 ja 向けの未使用 LP コード（約370行）が残っている

### 調査F：イベントカレンダー（`/events/`）

**F-1. データ構造と処理**

| 項目 | 現状 | 根拠 |
|---|---|---|
| データ | posts（ja）の `eventDate`（＋`eventEndDate`・`eventLocation`）。**カテゴリ不問** | `events.html:11-38` |
| 開始・終了 | 単日・`A/B`・配列を正規化して start/end | `events.html:13-29` |
| 複数日・長期 | start〜end の範囲を1行で表示。開催期間内は「開催中」 | `events.html:70-78` |
| 並び | 開催予定は start 昇順・月見出し。終了分は start 降順で直近30件を折りたたみ | `events.html:39-44,90-102` |
| 終了判定 | `end < 今日(JST)` で終了扱い（ビルド時点） | `events.html:8,41` |
| 重複排除 | **なし** | — |
| 絞り込み | **なし**（エリア・カテゴリ・対象年齢・無料など） | — |
| 期間別表示 | なし。月見出しのみ | — |
| 詳細導線 | 行全体が記事へのリンク | — |
| 構造化データ | ページは ItemList（開催予定30件）。各記事に Event JSON-LD | `events.html:110-117`、`event-jsonld.html` |
| 本番の掲載数 | 開催予定71行、終了30行（10/4 時点） | 実画面 |

**F-2. 【問題】同一イベントの重複**

本番の開催予定71行で確認した例:

- slug 衝突で同じ URL の行が2本: `sheraton-thai-food-buffet-2026`、`gyotoku-machibar-october-2026`
- 同じイベントの別記事: ヒルトン「ハロウィーンスイーツビュッフェ」（`hilton-tokyo-bay-gothic-palace-2026` と `hilton-gothic-palace-2026`）、三番瀬カニ釣り（本記事と「（続報）」）

原因は、イベントの単位が記事であること（**イベント ID・共通データなし**）、続報の作り方（新記事を書く運用）、slug 衝突の3つ。**確認済み**

**F-3. 【問題】イベント以外の記事の混入**

`eventDate` を持つ ja 366記事のうち、「イベント」以外のカテゴリが **224記事**（スポーツ73・開店閉店65・グルメ32・お知らせ30・子育て20・ニュース4）。開店日・試合日・制度開始日・テレビ受信障害の電波発射日などがカレンダーに載る。**確認済み**

**F-4. 【問題】Event 構造化データの正確性**

`eventDate` がある posts すべてに Event JSON-LD を出力しており（`event-jsonld.html:13`）、次の問題がある:

- お知らせ・開店日・制度開始日も Event になる（例: テレビ受信障害が `@type: Event`）
- `organizer` が無いと既定値「浦安市」（`event-jsonld.html:35`）。民間・ホテル主催のイベントまで主催者が浦安市と記述される
- `location.address.addressLocality` が常に「浦安市」（`:51`）。行徳（市川市）や葛西（江戸川区）のイベントでも浦安市
- `eventFee` の文字列（例「500円」）をそのまま `price` に入れる（`:65`）
- `eventStatus` は常に Scheduled、`startDate` に時刻なし
- JSON をテンプレート文字列で組んでおり、タイトルに `"` が入るとエスケープされない可能性（`:41` は plainify のみ）**要検証**

影響: Google のイベントリッチリザルトの品質ガイドラインに抵触するおそれ（**要検証**: GSC の拡張レポートで確認が必要）。

**F-5. 改修に必要な変更範囲**

- 最小: `events.html`・`event-jsonld.html` に「イベントとして扱う条件」（カテゴリ or 明示フラグ）を加え、`article-card.html` の日付表示を分離する
- 本格: イベント単位のデータ（`eventId`、または `data/events.yaml`）を導入し、複数記事を1イベントに束ねる。絞り込み・期間別表示は JS（全件 JSON を埋め込みクライアント側でフィルター）で実装できる
- 記事管理への影響: 投稿ツールの必須項目・記事化プロンプトのルール変更が伴う（C-④）

### 調査G：技術的SEO

前回の技術監査（2026-09-04、`docs/seo/01-technical-audit.md`）で、内部リンク切れ0・alt 欠落0・h1 重複0・hreflang コード正常・薄いタグ noindex 稼働などを確認済み。本調査では**その後の差分と未解決項目**を中心に確認した。

**G-1. 基本設定（確認済み）**

| 項目 | 実装 | 評価 |
|---|---|---|
| title | `<タイトル> | 浦安ぽーたる`。ホームは `homeTitle` | 正常。ページ送り（`/posts/page/2/`）は1ページ目と同じ title |
| meta description | `.Description` → `.Params.description` → Summary → サイト既定 | 正常（タグ・ページ送りは共通文） |
| canonical | 自己参照（`head.html:40`）。**ページ送りは1ページ目向き**（前回監査 A-5、未対応） | 低 |
| robots meta | 本番は index,follow。3件未満タグは noindex,follow。`robotsNoIndex` で除外。404 ページは index,follow（404 ステータスなので実害小） | 概ね正常 |
| robots.txt | `Allow: /` ＋ sitemap のみ | `/admin/`・`/tools/` も許可 |
| sitemap | sitemapindex ＋言語別5本。薄いタグ・noindex を除外 | 正常。ja に重複 `<loc>` 13件（B-6）。非 ja トップの中継ページ（`/en/` 等）が index,follow で掲載 |
| OGP / Twitter | PaperMod＋上書き。og:locale が `ja`（`ja_JP` が望ましい） | 低 |
| 見出し | h1 は1つ（前回監査）。カード内 h3 | 正常 |
| alt | タイトル流用（前回監査で欠落0） | 正常 |

**G-2. 構造化データ**

| 種類 | 実装 | 指摘 |
|---|---|---|
| Organization | ホームのみ（`schema_json.html:12-39`）。sameAs が空配列 | 低（X アカウントがあるのに sameAs 未設定） |
| WebSite | ホームのみ（`extend_head.html:26-36`） | SearchAction なし |
| BlogPosting / NewsArticle | 全記事。「ニュース」カテゴリだけ NewsArticle | articleBody に本文全文（HTML サイズ増） |
| BreadcrumbList | URL 階層ベース | 表示パンくずと不一致（E-3） |
| Event | eventDate がある posts（F-4） | **高: 内容不適合** |
| FAQPage | `faq:` frontmatter から生成 | 正常 |
| ItemList | `/events/`・`/open-close/` | 誤分類がそのまま name に入る |

**G-3. URL・インデックス**

- HTTP→HTTPS・www→apex は 301（GitHub Pages）。末尾スラッシュなしは 301 で付与
- 大文字小文字: 大文字 URL は 404（重複 URL は発生しない）
- WordPress 時代の URL は 404。posts のうち 2025-06〜07 の 115記事は WordPress からの移行記事とみられ、日本語ファイル名 URL のまま維持されている。移行時のリダイレクト網羅性は**未確認**（旧 URL 一覧が必要）
- クエリ付き（`/?p=123`）は 200 でトップを返す（canonical で吸収）
- 公開・非公開: draft・未来日付はビルドから除外され、サイトマップにも載らない（整合）。slug 衝突で消えた記事は URL ごと内容が差し替わっている（B-6）
- `/tools/post-tool.html`・`/admin/` が本番で 200、noindex なし（前回監査 A-4。運営判断で据え置き）

**G-4. 多言語 SEO**

- 言語別 URL: サブディレクトリ方式。翻訳の対応付けはファイル名サフィックス
- hreflang: 双方向・自己参照・x-default（en）を出力（`head.html:115-122`）。zh は `zh-Hans`、zh-tw は `zh-Hant-TW`
- 指摘1: **ja トップ `/` と `/en/`・`/zh/` 等が hreflang で対応付けられているが、非 ja トップは meta refresh の中継ページ**で、内容も等価ではない（地域ニュース⇔旅行ガイド）。x-default も中継ページを指す
- 指摘2: `<html lang="zh">`（簡体）・`lang="zh-tw"`。hreflang 側は正しいが、lang 属性は `zh-Hans`/`zh-Hant-TW` の方が整合する（低）
- 指摘3: posts 翻訳（en/zh-tw 各6本）は ja と同じ slug で対応する。ja 側で slug 衝突すると翻訳との対応も崩れる（sheraton のケース）
- 言語切替: ヘッダーのドロップダウン（翻訳がある場合のみ）

**G-5. 内部リンク**

- 柱構造（旅行4本柱・生活ガイド4ハブ）と孤立記事禁止ルールは CLAUDE.md で恒久化済み
- 今回、ASCII パスの内部リンク 1,256件を機械確認し、切れは0件（`/tags/keiyo-team6+` は `&#43;` 表記による誤検出）。非 ASCII（日本語）パスは環境の都合で検査できず、前回監査（0件）の結果に依拠する（**要再検証**: `scripts/check-internal-links.ps1` を `public/` を消してから実行）
- ホテル比較記事 → 個別ページのリンクは十分ある。個別 → 比較は `lg-side-cta`（比較へ戻る導線）あり

### 調査H：表示速度・画像・パフォーマンス

> **PageSpeed Insights API はキーなしの共有枠が枯渇（HTTP 429）で取得できなかった**（前回監査と同じ）。GSC の Core Web Vitals エクスポート（`docs/seo/gsc/2026-09-03/gsc_cwv-*.csv`）は空（データ不足）。**LCP・INP・CLS の実測値は本書に記載しない**。

**H-1. 参考計測（アプリ内ブラウザ・単発・本番トップ）**

| 指標 | 値 | 注記 |
|---|---|---|
| TTFB | 68ms | Fastly キャッシュ HIT 後。前回監査は 439ms |
| DOMContentLoaded | 623ms | PC幅 |
| load | 1,145ms | 同上 |
| リクエスト数 | 45 | — |
| 外部ホスト数 | **16**（googlesyndication、doubleclick、adtrafficquality×2、googletagmanager、google-analytics、valuecommerce×4、imgvc、emrld.ltd・emrld.cc、mn-tz.com、travelpayouts、jsdelivr） | — |
| CLS | 0 | 計測時点 |
| LCP | 取得不可 | この環境では LCP エントリが返らなかった |

※ CWV の評価には使えない参考値。

**H-2. コード上の潜在リスク（確認済み）**

| # | 内容 | 根拠 |
|---|---|---|
| 1 | **Tabler Icons webfont 全セットを CDN から読み込む**: CSS 248KB（レンダーブロッキング）＋woff2 820KB。`.ti{font-display:swap}` はセレクタに書いているため無効（`font-display` は `@font-face` 内でのみ有効） | `extend_head.html:13-15`（curl でサイズ計測） |
| 2 | 自前 CSS 205KB（gzip 40KB）を `rel="preload stylesheet"` で読み込み、単一ファイルで全ページ共通 | `head.html:82` |
| 3 | 画像は `static/` 直置き（28MB・166ファイル、jpg 中心・WebP 10）。Hugo 画像処理なし、srcset なし、width/height なし | `article-thumb.html`、`single.html:58` |
| 4 | **記事のアイキャッチ（LCP 候補）が `loading="lazy"`**（記事詳細のカバー画像） | `single.html:58`、`hotels/single.html:130` |
| 5 | 全ページで AdSense・LinkSwitch・Travelpayouts Drive・GA を読み込む（第三者 JS のメインスレッド負荷。INP リスク） | `extend_head.html` |
| 6 | サイドバーに全記事の日付 JSON（約9.6KB）を毎ページ埋め込み。posts の増加に比例して増える | `sidebar-calendar.html:67-69` |
| 7 | `/search/` の Fuse インデックス `index.json` が ja 2.38MB（全文含む） | ビルド成果物 |
| 8 | HTML はミニファイ無効（`minify.disableHTML: true`）。トップ 62KB・記事 73KB（非圧縮） | `hugo.yaml:242-248` |
| 9 | キャッシュは全リソース `max-age=600`（GitHub Pages 固定）。fingerprint 付き CSS も10分で再検証 | 本番ヘッダー |
| 10 | Cloudflare プロキシ無効のため、Cloudflare 側の圧縮・キャッシュ・画像最適化は効いていない | DNS |

### 調査I：GA4・Search Console・収益計測

| 項目 | 現状 | 確認状況 |
|---|---|---|
| GA4 | `G-8S20X6BDPW`。Hugo 内蔵テンプレートで gtag を直書き（本番のみ）。**Do Not Track が有効な訪問者は GA を読み込まない**（計測漏れ。affiliate_click も送信されない） | 確認済み（ビルド HTML） |
| GTM | 未導入 | 確認済み |
| Search Console 所有権 | `google-site-verification` meta はなし。DNS（Cloudflare）か HTML ファイルでの確認と推測。Naver の確認 meta はあり | meta 不在は確認済み・方式は未確認 |
| ページビュー | GA4 の page_view（拡張計測の設定は未確認） | 未確認 |
| 独自イベント | `affiliate_click`、`topic_cta_click`（記事内 CTA）、`related_click`（関連記事・同エリア） | 確認済み（`affiliate-tracking.html`） |
| 外部リンククリック | 既知 ASP・sponsored・`lg-book-btn` のみ。一般の外部リンクは GA4 拡張計測（outbound click）頼み | 拡張計測の有効性は未確認 |
| ホテル別クリック | 個別ページでは page_path でホテルが分かる。**ホテル ID のパラメータ・配置（cta_pos）は予約ボタンに付いていない**ため、同一ページ内の3配置は区別不可 | 確認済み |
| 記事別クリック | page_path で識別可 | 確認済み |
| 二重計測 | 1クリックで `topic_cta_click` と `affiliate_click` が両方出る（名前が違うので同名の重複ではない）。拡張計測の `click` とも併存。GA タグの重複読み込みはない（1回） | 確認済み（コード） |
| カスタムディメンション登録 | asp・cta_pos 等が GA4 管理画面で登録済みか | 未確認 |
| Cookie・同意 | 同意バナー・Consent Mode **なし**。プライバシーポリシーに GA4・AdSense・アフィリの記載あり（`content/privacy.md`）。EEA/英国からの閲覧に AdSense を出す場合は認定 CMP が必要（Google の要件） | 実装なしは確認済み・要否は要検証 |
| AdSense | `ca-pub-3372468923504472`、全ページで読み込み。**自動広告のスロットが子育てガイドにも挿入される**（実画面で `ins.adsbygoogle`、計測時は unfilled） | スロット確認済み・配信は要検証 |
| 既存の基準データ | `docs/seo/gsc/2026-09-03/` に GSC 16か月ページ×月、3か月ページ×クエリ、国×端末、インデックス状況、リンク、GA4 ページ・流入チャネルのエクスポートあり | 確認済み（ファイル存在のみ。数値は本書で評価しない） |

### 調査J：運用・保守・改修リスク

| 項目 | 現状 |
|---|---|
| 新規投稿 | 投稿ツール → main 直コミット → 自動デプロイ（数分） |
| 更新 | 同じファイル名で上書き（確認ダイアログあり）。lastmod 更新は警告のみ |
| ブランチ / PR | 記事は main 直。改修は `claude/*` ブランチ＋PR（`#2` の実績あり）。ブランチ保護の有無は**未確認** |
| プレビュー | なし |
| 自動テスト | なし |
| ロールバック | `git revert` → push で再デプロイ。GitHub Pages の過去 deployment の再デプロイも可能。保護付きバックアップタグ `backup-2026-10-04-main` と `urayasu-portal-backup/full-2026-10-04`（読み取り専用コピー）あり |
| バックアップ | Git 履歴＋上記タグ＋OneDrive 上の作業ツリー |
| データ再生成 | ホテル系 YAML は CSV からの手動生成（CI では生成しない） |

**改修リスク**

- **既存記事**: 日付・分類の表示ロジックは article-card 等の共通 partial で、修正は全記事に一斉に効く。frontmatter の書き換えは不要にできるが、既存の `eventDate` の意味混在（224記事）を機械的に分類するのは不可能で、**手動の棚卸しかルール（カテゴリ判定）での割り切り**が必要
- **URL**: slug 衝突の解消で旧記事を復活させると、現在の URL の中身（続報記事）が変わる。aliases の設計が必要
- **アフィリエイト**: `hotel-book-buttons.html`・`tp-link.html`・`hugo.yaml` の affiliate ブロック・CSV の予約 URL 列が収益の生命線。リンク形式の変更前後で生成 HTML の差分（URL パラメータ）を機械比較すべき（過去に Allianceid 誤設定で3か月クリック0の前例あり）
- **並行編集**: 記事は別環境から1日数本 main に入る。長期ブランチは衝突しやすい（特に `content/posts/`・`data/openclose.yaml`）

**複数工程で共通して変更される可能性が高いファイル**

| ファイル | 関わる工程 |
|---|---|
| `layouts/partials/article-card.html`、`article-thumb.html` | 1・4・5 |
| `layouts/index.html`、`posts/list.html`、`list.html`、`single.html` | 1・4・8 |
| `layouts/_default/events.html`、`partials/event-jsonld.html`、`event-ended-notice.html`、`sidebar-calendar.html` | 1・5・7 |
| `layouts/_default/openclose.html`、`data/openclose.yaml` | 1 |
| `layouts/partials/hotel-book-buttons.html`、`hotel-compare-table.html`、`travel-guide/hotels/*.html` | 2・3・6 |
| `layouts/partials/affiliate-tracking.html`、`extend_head.html` | 2・3・9 |
| `layouts/partials/head.html`、`templates/schema_json.html` | 1・6・7 |
| `assets/css/extended/custom.css` | 2・4・5・6 |
| `hugo.yaml` | 2・3・7・9 |
| `static/tools/post-tool.html` ＋外部の記事化プロンプト | 1・5 |
| `hotel-database-full.csv` → `data/hotels*.yaml` | 2・6 |

---

## 第5章 問題点の優先順位一覧

| ID | 問題点 | 重要度 | 影響範囲 | 改修難易度 | 根拠・確認状況 | 評価理由 |
|---|---|---|---|---|---|---|
| P01 | slug 重複で10記事が本番から消失し、一覧・カレンダーに同一 URL が二重掲載 | **緊急** | posts 10本＋一覧・カレンダー・サイトマップ | 中 | B-6／確認済み | 公開したつもりの記事が見えない。運用が続く限り増える |
| P02 | 投稿ツール・CI に slug 重複／date 未来／slug・date 必須の検証がない | **緊急** | 今後の全投稿 | 低〜中 | C-④／確認済み | P01 の再発源。外部環境からの投稿のため、関門はビルド側にも必要 |
| P03 | 記事カードの表示日が eventDate（生文字列・範囲表記）で、公開日と混在 | 高 | 全一覧（ja 366記事） | 低 | C-1-a／確認済み | 診断の指摘そのもの。partial 1箇所で直せる |
| P04 | eventDate の意味混在で、非イベント224記事がカレンダー・Event JSON-LD に載る | 高 | /events/、構造化データ | 中 | F-3・F-4／確認済み | カレンダーの信頼性と構造化データの適合性 |
| P05 | Event JSON-LD の主催者・所在地の既定値、price の文字列混入 | 高 | Event 出力約366ページ | 低 | F-4／確認済み（ポリシー影響は要検証） | 事実と異なる構造化データ |
| P06 | ホテル比較ページ5種に予約導線ゼロ（全言語） | 高 | 収益導線の中核ページ | 中 | D-5／確認済み | 最優先施策の対象。既存部品で実装可 |
| P07 | 開店閉店年表の誤分類と種別語彙の不足、年間件数の誤り | 高 | /open-close/（121記事） | 中 | C-2-a／確認済み | 診断の指摘。噂・予定の扱いは運営判断も要る |
| P08 | イベント単位のデータがなく、同一イベントが重複掲載 | 中 | /events/ | 中〜高 | F-2／確認済み | 根本対応にはデータモデル追加が必要 |
| P09 | アフィリ計測に配置・ホテル ID がなく、Agoda/Booking は素 URL（提携状況不明） | 中 | 収益の計測と最大化 | 低（計測）／運営判断（提携） | D-4・D-7・I／確認済み・提携は未確認 | 工程2の効果測定の前提 |
| P10 | AdSense 自動広告が子育て等のガイドにも挿入される | 中 | 生活ガイド | 低（管理画面）〜中 | I／スロット確認済み・配信要検証 | 運営方針との不一致 |
| P11 | Hugo `latest`・pagefind の版未固定と廃止予定 API | 中 | 全サイトの公開 | 低 | A-1／確認済み | 突発的な公開停止リスク |
| P12 | 「イベント イベント」等のカテゴリ名二重表示 | 中 | 一覧・詳細（画像なし82%） | 低 | C-3-b／確認済み | 診断の指摘。見た目・読み上げ |
| P13 | Tabler 全セットのアイコンフォント（1MB 超）、画像の最適化なし、LCP 画像に lazy | 中 | 全ページ・モバイル | 中 | H-2／確認済み（CWV 実測は未確認） | 実測待ちだが改善余地は明確 |
| P14 | トップの「3つの入口」がスマホで約7画面下、イベントがナビにない | 中 | トップ | 中 | E-1／確認済み | 柱スイッチャーで補えているため緊急ではない |
| P15 | 検索が2系統（Fuse 2.4MB／Pagefind） | 低〜中 | 検索 UX・速度 | 中 | E-4／確認済み | 統合で軽量化と一貫性 |
| P16 | ページ送り canonical が1ページ目向き、title 重複 | 低 | 一覧ページ送り | 低 | G-1／確認済み | 前回監査からの持ち越し |
| P17 | 非 ja トップ（中継ページ）が hreflang・sitemap・index 対象 | 低 | 多言語 SEO | 低 | G-4／確認済み | 中継ページの評価が分散 |
| P18 | posts と life-guide の aliases 衝突、カテゴリ term の出力衝突 | 低 | 該当 URL | 低 | B-7・B-8／確認済み | 出力順依存の不安定さ |
| P19 | カテゴリ辞書が9テンプレートに重複 | 低（保守） | 改修工数 | 低 | A-2／確認済み | 工程1・4の前処理として効く |
| P20 | 内部ツール（/admin/・/tools/）が index 可能 | 低 | SEO・セキュリティ表面 | 低 | G-3／確認済み | 前回は運営判断で据え置き |
| P21 | 表示パンくずと BreadcrumbList の階層不一致 | 低 | posts | 低 | E-3／確認済み | — |
| P22 | サイドバーカレンダーの日付セルがキーボード操作不可 | 低 | a11y | 低 | E-5／確認済み | — |
| P23 | 「開催中／終了」がビルド時点で固定、境界が JST 9時 | 低 | events・終了通知 | 低 | C-1-b／確認済み | 毎日ビルドが走れば実害小 |
| P24 | ローカルでも本番タグが出力される（`env: production` 固定） | 低 | GA データの純度 | 低 | A-3／要検証 | — |

---

## 第6章 改修工程ごとの技術的な検討

### 工程1：記事の日付・分類・重複表示の修正

| 観点 | 内容 |
|---|---|
| 目的 | 公開日とイベント日の混同、開店閉店の誤分類、カテゴリ名・カードの重複表示、slug 衝突の解消 |
| 現状 | 第4章 C・B-6 |
| 主な対象ファイル | `article-card.html`、`article-thumb.html`、`single.html`、`index.html`、`posts/list.html`、`list.html`、`_default/openclose.html`、`data/openclose.yaml`、`event-jsonld.html`、`events.html`、`static/tools/post-tool.html`、`.github/workflows/hugo.yml`（検証追加）、衝突している posts |
| 再利用できる機能 | `openclose.yaml` のキュレーション機構、`eventEndDate` 等の既存対応項目、`event-ended-notice` の判定 |
| 新規機能の候補 | frontmatter 検証スクリプト（CI で実行。slug 重複・date 形式・未来日・必須項目・eventDate 形式）、カテゴリ定義 data、表示日の共通 partial、店舗ステータスの語彙 |
| 改修内容 | ①slug 衝突の解消と再発防止（ツール＋CI）②カードを公開日に統一し、イベント日は別ラベル ③eventDate の意味分離（例: イベント＝`eventDate`、それ以外＝`notableDate`）。旧データは「カテゴリがイベント以外なら Event 扱いしない」等のルールで後方互換 ④開店閉店の種別拡張と正規表現の順序修正 ⑤二重ラベル解消 |
| 難易度 | 中（コードは小さいが、データ移行とプロンプト連携が要る） |
| 依存関係 | 工程5（カレンダー）・工程4（カード）・工程7（Event JSON-LD）の前提。**記事化プロンプト側の改訂と同時リリース**が必要 |
| 既存機能への影響 | 全一覧の日付表示が変わる。カレンダーの掲載件数が減る（非イベントの除外）。投稿ツールのブロック条件が増える |
| 検証の注意点 | 変更前後のビルドで、全 posts の「表示日・カレンダー掲載有無・JSON-LD 種別」の一覧を作って差分を確認する。投稿ツールは BOM・CRLF・インライン配列の入力でも試す |

### 工程2：ホテル比較ページの予約導線強化

| 観点 | 内容 |
|---|---|
| 目的 | 比較・選択段階のページから予約サイトへ直接誘導する |
| 現状 | 比較5ページで予約リンク0。個別ページにのみ3配置 |
| 主な対象ファイル | `hotel-compare-table.html`、`hotel-book-buttons.html`、`shortcodes/hotel-table.html`、`travel-guide/hotels/list.html`・`compare.html`、`content/travel-guide/hotels/{kids,budget,access}.*.md`（5言語）、`custom.css`、`i18n/*.yaml` |
| 再利用できる機能 | 予約ボタン partial（言語別の ASP 出し分け・通貨・アフィリ ID 付与込み）、データ駆動の比較表、PR 表記の i18n |
| 新規機能の候補 | 比較表の「予約」列（コンパクトボタン）、柱記事用「ホテルカード」ショートコード（slug 指定で名前・区分・価格目安・写真・予約・個別リンクを出す）、ボタンへの `data-hotel`・`data-cta-pos` 付与 |
| 改修内容 | 比較表に予約列を追加 → 柱記事の推奨ホテル箇所をショートコード化 → PR 表記を追加 |
| 難易度 | 中（5言語×手書き本文の置き換えが工数の主体） |
| 依存関係 | **工程3の計測（配置・ホテル ID）を先に入れる**と効果測定できる。ASP 提携状況（第9章）次第で ja の表示 ASP が変わる |
| 既存機能への影響 | 予約 URL の生成ロジックは変えずに呼び出し箇所を増やすだけなら、既存リンクへの影響はない |
| 検証の注意点 | 生成 HTML の全予約 URL を抽出し、改修前後で個別ページの URL が完全一致することを確認。名称のみ掲載の3軒（ファッションホテル）にボタンが出ないことを確認（CLAUDE.md 永続ルール） |

### 工程3：GA4・Search Console の計測環境整備

| 観点 | 内容 |
|---|---|
| 目的 | 改修効果を測るための基準値取得と計測の精度向上 |
| 現状 | GA4 直書き・独自イベント3種・DNT 除外・GTM なし・同意管理なし |
| 主な対象ファイル | `affiliate-tracking.html`、`hotel-book-buttons.html`（data 属性）、`head.html`／`extend_head.html`、`hugo.yaml` |
| 再利用できる機能 | イベント委譲型のクリック計測 |
| 新規機能の候補 | 予約ボタンへの `data-hotel`（slug）・`data-cta-pos`・`data-asp`、GA4 カスタムディメンション登録、DNT 方針の見直し、（必要なら）Consent Mode |
| 改修内容 | 計測属性の付与 → GA4 側の登録 → 基準値の取得（第8章） |
| 難易度 | 低（コード）／GA4 管理画面作業は管理者 |
| 依存関係 | 工程2・4・6・9の効果測定の前提。**工程2より前に**実施するのが望ましい |
| 既存機能への影響 | data 属性の追加のみなら表示・リンクへの影響なし |
| 検証の注意点 | GA4 DebugView で、ボタン3配置・LinkSwitch 書き換え後のクリックがそれぞれ正しく送られるかを確認 |

### 工程4：トップページの UI 改善

| 観点 | 内容 |
|---|---|
| 目的 | 3領域（トピックス・生活・旅行）への迷わない導線と、新着の見やすさ |
| 現状 | E-1。トップ＝トピックスの一覧型。3入口はスマホで下部 |
| 主な対象ファイル | `layouts/index.html`（ja 部分）、`article-card.html`、`sidebar-*.html`、`custom.css`、`data/lifeguides.yaml` |
| 再利用できる機能 | 柱スイッチャー、`top-guide-cards`、`featured-hotels`、`lifeguides.yaml` の updates |
| 新規機能の候補 | 3領域のダイジェスト枠、「今週のイベント」枠（工程5のデータを利用） |
| 難易度 | 中 |
| 依存関係 | 工程1（カードの日付・ラベル）を先に直す。イベント枠は工程5に依存 |
| 既存機能への影響 | トップのみ。index.html の未使用コード（非 ja LP）は削除候補 |
| 検証の注意点 | スマホ幅での要素位置（本書 E-1 の計測値を基準に）、CLS、画像なし記事の見え方 |

### 工程5：イベントカレンダーの UI・機能改善

| 観点 | 内容 |
|---|---|
| 目的 | 重複・非イベント混入の解消、期間別・絞り込み表示 |
| 現状 | 第4章 F |
| 主な対象ファイル | `_default/events.html`、`event-jsonld.html`、`sidebar-calendar.html`、`content/events.md`、`custom.css`、（新規）`data/events.yaml` か frontmatter `eventId` |
| 再利用できる機能 | 日付正規化ロジック、月別描画、ItemList 出力 |
| 新規機能の候補 | イベント ID による束ね、「今日／今週末／今月」タブ、エリア・カテゴリ・無料・子ども向けの絞り込み（ビルド時に JSON を埋め込み、JS で絞る）、エリア項目 |
| 難易度 | 中〜高（データモデル次第） |
| 依存関係 | **工程1の eventDate 意味分離が前提**。エリア・対象年齢の項目追加は投稿運用の変更を伴う |
| 既存機能への影響 | 記事のイベント情報ボックス（ほぼ非表示運用）、サイドバーカレンダー |
| 検証の注意点 | 「今日」判定は静的サイトではビルド時固定のため、期間タブはクライアント JS で判定するのが確実 |

### 工程6：ホテル・旅行関連記事の SEO 強化

| 観点 | 内容 |
|---|---|
| 目的 | ホテル系の検索流入増 |
| 主な対象 | `content/travel-guide/**`（5言語）、`hotels/single.html`、`schema_json.html`、`faq-jsonld.html`、CSV |
| 再利用 | fact ショートコード、FAQ JSON-LD、facility-table、hotel-table、docs/redesign の記事テンプレート |
| 新規候補 | ホテル個別ページの Hotel／LodgingBusiness 構造化データ（住所・座標は CSV にある）、価格の確認日表示 |
| 難易度 | 中 |
| 依存関係 | 工程2（比較ページの改修と同時にやると手戻りが少ない）、工程3（計測） |
| 注意 | 価格は推定で埋めない（CSV の値と確認日のみ）。「おすすめしない人」節の維持（CLAUDE.md） |

### 工程7：技術的 SEO・多言語 SEO の改善

| 観点 | 内容 |
|---|---|
| 対象 | Event JSON-LD（P04・P05）、ページ送り canonical（P16）、非 ja トップの中継ページ（P17）、Organization sameAs、og:locale、lang 属性、内部ツールの noindex（P20）、パンくず一致（P21）、Hugo 版固定（P11）、**パフォーマンス（P13・P15）** |
| 再利用 | head.html・schema_json.html の上書き構造 |
| 難易度 | 低〜中（小改修の集合） |
| 依存関係 | Event 関連は工程1の後。Hugo 版固定は**最初に**実施すべき（全工程の土台） |
| 注意 | hreflang 変更は Search Console の国際ターゲティングで反映を確認 |

### 工程8：既存記事の情報拡充・内部リンク改善

| 観点 | 内容 |
|---|---|
| 対象 | posts→ガイド導線（`guide_map.yaml`、`related-guide.html`、`extend_post_content.html`）、関連記事スコア、続報記事の束ね（工程1・5と連動）、開催時刻誤りの残る旧記事（前回監査の申し送り） |
| 再利用 | 既存の導線3系統、`docs/seo/03-backlog.md` |
| 難易度 | 低〜中（記事単位の手作業が主） |
| 依存関係 | 工程1（slug 衝突の解消方針）を先に。GSC データで対象を選ぶ |

### 工程9：地域広告等による収益源の多様化

| 観点 | 内容 |
|---|---|
| 対象 | 広告枠の設計（データ駆動の掲載枠）、AdSense 自動広告の除外設定、既存の affiliate-box・topic-cta |
| 再利用 | `data/affiliate_ctas.yaml`＋`topic-cta.html`（カテゴリ・タグ連動の CTA 機構）、PR 表記 |
| 新規候補 | 地域広告主の掲載データ（`data/sponsors.yaml` 等）と表示 partial、PR 表記の統一、掲載面ポリシーの機械判定（子育て・介護等を除外） |
| 難易度 | 中（技術）＋営業・規約（運営） |
| 依存関係 | 工程3（計測）・工程4（トップの枠設計）。**広告非掲載ページの方針を先に実装で担保**する（P10） |

---

## 第7章 工程間の依存関係

### 7.1 依存関係図

```
[工程0.5 基盤] Hugo版固定 / CI に frontmatter 検証 / slug 衝突の解消
      │
      ├──▶ [工程1] 日付・分類・重複（データ定義＋表示）──┬──▶ [工程5] イベントカレンダー
      │                                                  ├──▶ [工程4] トップ UI ──▶ [工程9] 広告枠
      │                                                  └──▶ [工程7a] Event 構造化データ
      │
      ├──▶ [工程3] 計測（data属性・GA4登録・基準値）──┬──▶ [工程2] 比較ページ予約導線 ──▶ [工程6] ホテルSEO
      │                                               └──▶（全工程の効果測定）
      │
      └──▶ [工程7b] 小さな技術SEO（canonical・hreflang中継・noindex）／[工程7c] パフォーマンス
                                                       [工程8] 記事拡充・内部リンク（随時、1の後）
```

### 7.2 主な依存の根拠

| 依存 | 理由 |
|---|---|
| 0.5 → すべて | Hugo `latest` のままだと改修中に CI が突然壊れうる。CI 検証がないと工程1で決めたルールが外部投稿で崩れる |
| 1 → 5 | カレンダーの掲載条件・重複排除は eventDate の意味分離が前提 |
| 1 → 4 | トップの主役は記事カード。カード（日付・ラベル）の修正を先にしないと二度手間 |
| 1 → 7a | Event JSON-LD の出力条件はイベントの定義に従う |
| 3 → 2 | 予約導線の効果（配置別・ホテル別クリック）は計測属性がないと測れない。改修前の基準値も先に取る |
| 2 ↔ 6 | 同じ柱記事（kids/budget/access）を触るため、同時か連続で行うと手戻りが少ない |
| 3・4 → 9 | 広告枠の価値の説明（PV・クリック）と、枠の置き場所の設計が先 |
| 外部プロンプト ↔ 1・5 | posts の frontmatter 仕様を変える工程は、記事化プロンプト・投稿ツールの改訂と同時に出す |

### 7.3 工程表への提案（統合・分割・追加・順序変更）

| 提案 | 内容 | 理由 |
|---|---|---|
| **追加: 工程0.5「緊急修正と基盤」** | slug 衝突10件の解消、投稿ツール＋CI の frontmatter 検証（slug 重複・date 形式／未来日・必須項目）、Hugo／pagefind の版固定 | P01・P02・P11 は他工程より緊急で、全工程の土台になる |
| **分割: 工程1 → 1a・1b** | 1a＝データ定義（eventDate の意味分離・店舗ステータス語彙・カテゴリ定義の集約・プロンプト改訂）、1b＝表示修正（カード日付・二重ラベル・年表） | 1b はコード数行で即効性があり、1a の運営合意を待たずに出せる |
| **順序変更: 工程3を工程2の前へ** | 計測属性の付与と基準値取得を先に行う | 工程2の効果を測るため |
| **統合: 工程2＋6（ホテル）** | 同一ファイル群（柱記事5言語・比較表）を扱う | 手戻り防止 |
| **分割: 工程7 → 7a・7b・7c** | 7a＝Event 構造化データ（工程1後）、7b＝小規模な技術 SEO（いつでも可・早期）、7c＝パフォーマンス（アイコンフォント・画像・検索統合） | 暫定工程表にパフォーマンスが独立していないため明示する |
| 工程9の前提追加 | AdSense の掲載除外方針の実装（P10）を工程9の最初に置く | 方針違反の解消が先 |

### 7.4 推奨順序（案）

1. 工程0.5（緊急・基盤）
2. 工程1b（表示の即効修正）＋工程7b（小規模技術 SEO）＋工程3（計測）
3. 工程1a（データ定義＋プロンプト改訂）
4. 工程2＋6（ホテル）／工程5（カレンダー）
5. 工程4（トップ）／工程7a・7c
6. 工程8（随時）／工程9

---

## 第8章 改修前の基準値

### 8.1 記事数・ページ数（2026-10-04、`origin/main` 4c24564e）

| 区分 | 件数 | 集計基準 |
|---|---|---|
| posts（ja） | 737 | `content/posts/*.md` から `.en/.zh-tw` と `_index` を除外 |
| posts（en / zh-tw） | 6 / 6 | 同上（`_index` 除く） |
| 生活ガイド | 29 | `content/life-guide/*.md`（`_index` 除く） |
| 旅行ガイド（ja / en / zh / zh-tw / ko） | 20 / 24 / 23 / 25 / 23 | `content/travel-guide/*.md`（`_index` 除く） |
| ホテル配下（ja / en / zh / zh-tw / ko） | 54 / 54 / 53 / 54 / 53 | `content/travel-guide/hotels/*.md`（`_index` 除く） |
| ビルドページ数（ja / en / zh / zh-tw / ko） | 3,266 / 228 / 216 / 235 / 216 | Hugo ビルド統計（ページ送り・タクソノミー含む） |
| エイリアス HTML | 1,515 | meta refresh を含む index.html |
| サイトマップ URL（ja / en / zh / zh-tw / ko） | 1,071 / 103 / 98 / 107 / 97 | 言語別 sitemap.xml の `<loc>` |

### 8.2 posts のカテゴリ別（ja・`categories` の1件目）

| カテゴリ | 件数 |
|---|---|
| イベント | 240 |
| スポーツ | 120 |
| 開店・閉店 | 118（カテゴリページ表示は121） |
| お知らせ | 89 |
| グルメ・カフェ | 59 |
| ニュース | 56 |
| 子育て・教育 | 55 |

月別の公開数（ja＋翻訳、date 基準）: 2025-06: 82、2025-07: 33、2026-02: 1、2026-04: 40、2026-05: 47、2026-06: 123、2026-07: 120、2026-08: 159、2026-09: 127、2026-10（4日まで）: 17。

### 8.3 日付・分類関連の基準値

| 指標 | 値 |
|---|---|
| eventDate を持つ ja posts | 366（うち「イベント」以外のカテゴリ 224） |
| 公開日より後の eventDate（事前告知型） | 273（翻訳含む） |
| 公開日より前の eventDate（事後記事） | 86（翻訳含む） |
| slug 衝突グループ / 消失記事 | 9 / 10 |
| slug 未設定（ファイル名 URL） | 176 |
| UTF-8 BOM 付き posts | 193 |
| lastmod あり（ja） | 46 |
| cover 画像あり | 131（17.6%） |
| 開店閉店: キュレーション / 自動分類 | 61 / 57（自動のうち誤分類・要判断 18件程度） |
| /events/ 掲載数（本番） | 開催予定71・終了30（直近） |

### 8.4 ホテル

| 指標 | 値 |
|---|---|
| ホテル総数 | 48（通常45・名称のみ3）、7エリア |
| 個別ページ | 45（×5言語、zh/ko は一部欠け） |
| 予約URL保有（hotels_map の booking 46件中） | 楽天43・Agoda44・Trip.com44・Expedia45・Booking 0（検索URLで代替）・じゃらん0・Yahoo0 |
| 予約ボタン数/ページ | 個別: ja5・zh/zh-tw/en 11・ko 14。比較5ページ: 0 |
| アフィリ設定 | 楽天（直）・Trip.com（直・10/4修正）・VC LinkSwitch（pid 設定済み）・Travelpayouts（marker/trs 設定、p 値は KKday/Klook のみ）・Agoda cid 未設定 |

### 8.5 技術的 SEO 設定の現状

第4章 G に記載。前回監査（9/4）の「問題なし」項目は維持されている前提（今回再検証したのは canonical・robots・hreflang・sitemap・JSON-LD 種別・ASCII 内部リンク）。

### 8.6 表示性能

- 実測 CWV: **未取得**（PSI 429、GSC CWV はデータ不足）
- 参考: 第4章 H-1（単発計測）
- 静的指標: トップ HTML 62KB、記事 73KB、自前 CSS 205KB（gzip 40KB）、Tabler CSS 248KB＋フォント 820KB、外部ホスト16、`index.json` 2.38MB、`static/images` 28MB

**取得方法**: ①PSI はキーを発行して API 実行（`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=…&strategy=mobile&key=…`）、またはブラウザで pagespeed.web.dev を使う。対象はトップ・/posts/・/events/・/travel-guide/hotels/・/travel-guide/hotels/kids/・個別ホテル1件・posts 1件。②GSC「ウェブに関する主な指標」（データ蓄積後）。③CrUX（オリジン単位）。

### 8.7 計測（GA4 等）

| 項目 | 状況 | 管理者側で取得すべきデータ |
|---|---|---|
| GA4 | 導入済み（DNT 除外あり） | 直近90日: ページ別 PV・ランディング・`affiliate_click`（asp × page_path）・`topic_cta_click`・`related_click`。カスタムディメンション登録状況 |
| GSC | 9/3 時点のエクスポートあり（`docs/seo/gsc/2026-09-03/`） | 10月上旬時点で同じ形式を再取得（ページ×月、ページ×クエリ、国×端末、インデックス、拡張: イベント・FAQ・パンくず） |
| ASP | 未確認 | 楽天・Trip.com・ValueCommerce・Travelpayouts・Agoda: 月別クリック・成果・報酬（ホテル別が出せれば尚可） |
| AdSense | 未確認 | ページ別収益・自動広告の設定・除外 URL |

### 8.8 テスト・ビルド環境

- ローカル Hugo v0.161.1 extended（Windows）。python・node・gh は無し（PowerShell・Git Bash・curl・ImageMagick はあり）
- CI: ubuntu-latest、Hugo latest、Pagefind（npx）
- 自動テストなし。手動スクリプト4種（`scripts/check-*.ps1`、`audit-hotel-pages.ps1`）
- ビルド所要: 約8秒（ローカル）

**本調査でリポジトリ内のビルドを実行しなかった理由と、実行する場合のコマンド**: リポジトリ直下で `hugo` を実行すると `public/` と `resources/` が生成・更新されるため（どちらも .gitignore 対象だが作業ツリーは変わる）。今回は一時ディレクトリに `git archive origin/main` で展開してビルドした。再現手順は次のとおり。

```bash
mkdir -p /tmp/audit && git archive origin/main | tar -x -C /tmp/audit
rmdir /tmp/audit/themes/PaperMod && cp -r themes/PaperMod /tmp/audit/themes/
cd /tmp/audit && HUGO_ENVIRONMENT=production hugo --minify --baseURL "https://urayasu-portal.com/" \
  --destination /tmp/audit-public --cacheDir /tmp/audit-cache --printPathWarnings
```

---

## 第9章 今後の作業に必要な情報（管理者への確認事項）

1. **記事化プロンプトの現行版**（リポジトリ外）: `date`・`slug`・`eventDate`・`categories` の生成ルール。工程1・5で仕様を変えるときの改訂担当と反映方法
2. **slug 衝突で消えた10記事の扱い**: 旧記事を別 URL で復活させるか、続報へ統合して旧記事は廃止するか（現在の URL は続報が占有）
3. **eventDate の定義**: お知らせ・開店日・試合日をカレンダーに載せたいか（載せるなら「イベント」と別の表示区分にするか）
4. **開店閉店の「出店予定か（求人で判明）」**のような未確定情報を年表・件数に含めるか
5. **ASP の提携状況**: Agoda Partners の cid 承認、Travelpayouts の Booking/Agoda/Trip の p 値、ValueCommerce LinkSwitch で Booking.com・Agoda が提携済みか、じゃらん・Yahoo!トラベルの提携予定、ja でも Agoda/Trip.com を出してよいか
6. **AdSense**: 自動広告の有効範囲と除外ページ設定（子育て・介護・急病・防災の方針との整合）、EEA 向け CMP の要否
7. **GA4 / GSC へのアクセス**: 閲覧権限の付与（または定期エクスポートの提供）、GA4 のカスタムディメンション登録、拡張計測の設定、Do Not Track で計測を除外する方針を維持するか
8. **Cloudflare**: 権限の有無と、プロキシ（オレンジクラウド）を有効化する意向（キャッシュ・ヘッダー制御・リダイレクトルールが使えるようになる一方、GitHub Pages の証明書・設定の調整が必要）
9. **本番反映の承認手順**: 改修は PR 経由とするか、レビュー担当、ブランチ保護の有無、記事の main 直コミットとの共存ルール
10. **作業中ブランチ** `claude/urayasu-station-bus-guide-vwsd3q`（バス乗り場ガイド2コミット）と stash 5件の扱い
11. **`/admin/`（Decap CMS）の利用実態**: 使っていなければ撤去候補。`/tools/post-tool.html` を noindex 化してよいか
12. **ホテル価格の更新責任と頻度**: CSV「最低価格」「最終更新日」の運用
13. **WordPress 時代の URL 一覧**（あれば）: 移行リダイレクトの網羅性確認のため
14. **地域広告（工程9）の販売形態**: 枠の種類・期間・掲載不可カテゴリ

---

## 第10章 総合評価と推奨事項

### 10.1 改修前に解決すべき問題

- **P01 slug 衝突による記事消失**と、**P02 投稿ルートの検証不足**（再発防止）。工程表に入る前に止血すべき
- **P11 Hugo 版固定**（改修期間中の突発的なビルド失敗を防ぐ）
- 作業ブランチ・stash の整理方針の決定（並行編集の衝突防止）

### 10.2 最初に着手すべき改善施策

1. 工程0.5（上記）
2. 工程1b: `article-card.html` の日付を公開日に統一し、イベント日を別ラベルに。二重ラベル解消。年表の正規表現の順序修正（休業 → 一時休業扱い）。**影響が大きく、改修が小さい**
3. 工程3: 予約ボタンへの計測属性付与と基準値取得
4. 工程2: 既存の `hotel-compare-table`＋`hotel-book-buttons` を組み合わせた比較表の予約列

### 10.3 共通化・再利用が望ましい機能

- カテゴリ定義（色・アイコン・ラベル・説明）の data 化（現在9か所に重複）
- 日付表示（公開日・更新日・開催日）の partial 化
- 「イベントとして扱うか」の判定を1つの partial に集約（events・JSON-LD・カード・終了通知で共有）
- frontmatter 検証ロジックを投稿ツールと CI で共通化（同じルール定義を参照）
- ホテルカード（slug → データ → 表示＋予約）の共通ショートコード

### 10.4 現状のまま維持すべき仕組み

- CSV マスター → YAML 生成によるホテル情報の一元管理
- `hotel-book-buttons.html` の言語別 ASP 出し分けと、ID 未設定時は素 URL にする設計（誤計測防止）
- hreflang・canonical の基本実装、薄いタグの noindex、sitemap の除外ロジック
- `aliases` による URL 維持、柱構造と孤立記事禁止ルール（CLAUDE.md）
- push ビルド主体＋schedule 保険の公開方式
- fact ショートコード（料金・時刻の定数化と出典管理）
- ファッションホテル3軒の掲載ポリシー（name-only）

### 10.5 改修時に保護すべき既存資産

- **既存 URL**（日本語ファイル名 URL 176件を含む）と aliases
- **アフィリエイト URL**（楽天 hb.afl・Trip.com Allianceid/SID/sub・KKday/Klook の tp.media・VC pid）と `rel="sponsored"`
- **posts の投稿運用**（投稿ツール・記事化プロンプト・push 即時公開）
- GA4 の既存イベント名（`affiliate_click` 等。名称を変えると時系列が途切れる）
- 構造化データの FAQPage・BreadcrumbList
- `docs/` の設計・監査記録、`backup-2026-10-04-main` タグ

### 10.6 追加調査が必要な事項

- CWV 実測（PSI キー取得後、または GSC のデータ蓄積後）
- 非 ASCII パスを含む内部リンク全数検査（`public/` を消してから `scripts/check-internal-links.ps1`）
- GSC の拡張レポート（イベント・パンくず・FAQ のエラー有無）
- ASP 管理画面でのホテル別・ASP 別の実績
- AdSense の実配信ページと自動広告設定
- 記事化プロンプトの仕様（外部）
- コントラスト・キーボード操作の a11y 実測

### 10.7 全体工程表を確定するための技術的推奨事項

1. **工程0.5（緊急修正と基盤）を新設し、最優先にする**。内容は slug 衝突の解消、投稿ツール＋CI の検証、Hugo 版固定。posts は外部から毎日入るため、品質の関門は**ビルド（CI）側**に置く。
2. **工程1は「表示修正（1b）」と「データ定義（1a）」に分ける**。1b は即日出せる。1a は記事化プロンプトの改訂と同時リリースが条件で、旧 `eventDate` を読み続ける後方互換を必須要件にする。
3. **工程3（計測）を工程2の前に置く**。改修前の基準値（GA4・GSC・ASP の直近90日）を取得してから導線を変える。
4. **工程2と6はホテル系として連続実施**する。新規コンポーネントは「比較表の予約列」と「ホテルカード・ショートコード」に限り、URL 生成は既存 partial を再利用する。
5. **工程5は工程1aの完了が前提**。イベント ID の導入要否（記事束ね）は、運営の続報運用（新記事を書くか、旧記事を更新するか）と合わせて決める。
6. **工程7を3つに分け**、パフォーマンス（アイコンフォント・画像・検索の一本化）を明示的に工程化する。
7. 各工程の完了条件に、**「全 posts の表示日・カレンダー掲載・JSON-LD 種別」「全予約 URL」「全内部リンク」の変更前後の機械差分**を含める。

---

### 付録A：本調査でのリポジトリへの変更

- 新規作成: `docs/audits/phase0-site-audit.md`（本書）と `docs/audits/` ディレクトリのみ
- 既存ファイルの変更・削除: なし（調査前後で `git status` を比較して確認）
- ビルド・データ抽出はすべてリポジトリ外の一時ディレクトリで実施

### 付録B：本番で確認した主な URL（読み取りのみ）

`/`、`/posts/`、`/events/`、`/categories/イベント/`、`/travel-guide/hotels/`、`/posts/urayasu-tv-interference-november-2026/`、`/posts/aloha-urayasu-2026/`、`/posts/trial-seiyu-urayasu-open/`、`/life-guide/urayasu-kosodate-shien-matome/`、`/tools/post-tool.html`、`/admin/`、`/pagefind/pagefind-ui.js`、各種リダイレクト・404 確認用 URL（http・www・末尾スラッシュ・大文字・WordPress 形式）
