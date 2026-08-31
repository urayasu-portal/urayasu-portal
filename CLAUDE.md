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
cd "C:\Users\kadoh\OneDrive\ドキュメント\02-2 副業\urayasu-portal"
hugo --minify
git add -A
git commit -m "メッセージ"
git push origin main
```

GitHub Actions が自動で GitHub Pages にデプロイする。

## posts（トピックス）の公開ルール

### `date` の設定（最重要）

`date` が **push 時点より未来だと、その記事はビルドから落ちて公開されない**（`--buildFuture` を付けていないため）。記事化プロンプト側と以下のルールで揃えている。

| ケース | `date` |
|---|---|
| ①リサーチ対象日 = 記事を書いている当日 | 記事を書き出す時点の現在時刻（JST） |
| ②リサーチ対象日が過去の日付（前日分を調査した場合など） | リサーチ対象日の **19:00** JST |

- **必須条件**: `date` は必ず push 時点より前の時刻にする。判断できない場合はリサーチ対象日の 18:00 を使う
- ファイル名の日付（`YYYYMMDD-slug.md`）はリサーチ対象日に合わせる（`date` の日付と一致しないケースはない）
- ②で同日に複数記事がある場合、`date` が並ぶと表示順が不定になる。順序を固定したいときは 19:00 / 19:01 / 19:02 と1分ずつずらす
- 先の日付のイベントを**意図的に予約投稿**したい場合のみ、未来の `date` を使ってよい。ただし公開は下記 schedule 頼みになるため、確実に出したい日は手動実行すること

旧ルール（当日 22:00 JST 固定）は 2026-08-31 に廃止した。push が 20時台のため `date` が常に未来になり、毎晩手動デプロイが必要になっていた。

### 公開の仕組み

- **主経路は push ビルド**。`main` への push で [.github/workflows/hugo.yml](.github/workflows/hugo.yml) が走り、数分で公開される
- `schedule`（13:23 / 14:47 / 16:38 UTC）は**保険**。本来の予約投稿を拾う用と、プロンプトが旧ルールで運用された場合の受け皿。GitHub の schedule はベストエフォート配送で、2026-08-27〜29 は3日連続で発火しなかった。**これ単体を当てにしない**
- 発火時刻を `:05` から外しているのは、GitHub が「毎時00分前後は混雑し遅延・脱落しやすい」と明記しているため

### 「記事が反映されない」と言われたときの確認手順

1. `git fetch origin` してローカルと origin を比較する（投稿は**別環境**から行われるため、ローカルが behind になっていることが多い）
2. 本番の最終ビルド時刻を見る — `curl -sSI https://urayasu-portal.com/posts/ | grep -i last-modified`
3. 該当記事の `date` が push 時刻より未来でないか確認する（未来ならプロンプト側のルール未適用を疑う）
4. Actions の実行履歴を確認する。GitHub API は git の保存済み認証情報（`git credential fill`）で叩ける
5. 復旧は `workflow_dispatch` の手動実行

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

### 旅行ガイドの構造ルール（2026-08 再設計で確定・永続）

サイトは旅程4本柱で構成する。設計文書は `docs/redesign/`（00〜05）。

| 柱 | ハブ | 記事の置き場所 |
|---|---|---|
| 1. 計画・準備する | トップ `/travel-guide/` が兼務 | `content/travel-guide/` 直下 |
| 2. 泊まる先を選ぶ | `/travel-guide/hotels/` | `content/travel-guide/hotels/` |
| 3. 移動する | `/travel-guide/urayasu-maihama-access-guide/` | `content/travel-guide/` 直下 |
| 4. 滞在を楽しむ | `/travel-guide/urayasu-maihama-shinurayasu-tourism/` | `content/travel-guide/` 直下 |

新規記事・改稿時のルール：

1. **孤立記事を作らない** — 公開時に必ず「所属する柱のハブ」または既存記事本文からの導線を張る（ナビ掲載だけでは不可）。孤立が最大の機会損失だったことは `docs/travel-guide-inventory.md` 参照
2. **診断ファースト** — 記事の型は `docs/redesign/05-article-templates.md` に従う。冒頭は「あなたはどれですか」の分岐から
3. **事実は fact ショートコード** — 料金・時刻など共通の事実は `data/travel_facts.yaml` に定数化し `{{</* fact "..." */>}}` で参照。yaml には出典URLと確認日をコメント必須。frontmatter（FAQ等）ではショートコード不可のためリテラル記載し、yaml 更新時に同時に直す
4. **設備逆引きは facility-table ショートコード** — `{{</* facility-table "bath" */>}}` 等でデータ駆動の一覧を任意の記事に埋め込める（キー: bath/pool/laundry/convenience/station/limousine）
5. **多言語は ja マスター** — 構造（見出し・表・分岐）は5言語で同一。タイトル語彙は zh-tw / en の検索意図を優先（読者優先順位: 台湾＞英語圏＞国内）。ja だけ直して放置しない
6. **URL変更・統合時は aliases 必須** — 移動先ファイルの frontmatter に旧URLを列挙（GitHub Pages のため meta refresh + canonical になる）
7. **公開当日の記事は date を現在時刻より前に** — `buildFuture: false` のため未来時刻はビルドから落ちる
8. **ビルド後検証** — 内部リンクの全数到達チェック（`public/` に対する grep で機械確認）をしてからコミット

### データソース管理

- ホテル情報の追加・更新は `data/hotels.yaml` で一元管理
- 新規ホテル追加時は `policy: normal` または `policy: name-only` を必ず設定する
- `individual_page: true` かつ `slug:` を指定したホテルのみ個別ページを作成する
- アフィリエイトリンクが整備されるまでは予約リンク不要（プレースホルダー非表示で可）

---

## 生活ガイドセクション 構造ルール（2026-08 再設計で確定・永続）

サイトは二段診断トップ＋ライフステージ4ハブで構成する。設計文書は `docs/redesign-life/`（00〜04）。

| 入口 | ハブ | スポーク |
|---|---|---|
| 転入・住み替え | `urayasu-sumai-hikkoshi`（時系列チェックリスト型） | 市役所手続き・ごみ・国保年金税・駅別・バス・ペットほか |
| 単身・ふたり暮らし | `single-couple-life` | 急病・ごみ・手続き＋駅別・バス・スポーツ・公園・図書館 |
| 子育て | `urayasu-kosodate-shien-matome` | ステージ順シリーズ4本（妊娠出産→乳幼児→保育幼稚園→小中学生）＋横断（医療費・児童手当・ひとり親障がい） |
| シニア・介護 | `urayasu-koreisha-kaigo`（本人向け・冒頭で家族向けに分岐） | `kaigo-first-steps`（家族向け最初の一歩） |

横断6本（急病・防災・ごみ・市役所手続き・国保年金税・バス）はハブなしでトップ直下からの高速導線。

### posts⇔ガイド連携の運用ルール（最重要）

生活ガイドの「フックの源泉」化は posts との双方向連携で成立している。壊さないこと。

1. **posts 作成時のタグ付け** — `data/guide_map.yaml` の `tags:` に列挙されたタグに該当する記事なら、必ずそのタグを付ける。付ければ posts 側にガイドカードが自動表示される。個別に指定したい場合は frontmatter `guide:` で手動上書き（先勝ち1件）
2. **guide_map.yaml の増減** — 新ガイド追加時はマッピングを追加。ただし大票田タグ（「イベント」「開店・閉店」「グルメ」など数十件規模）は posts→ガイド方向には使わない（カードが出すぎてノイズになるため意図的に除外中）
3. **ガイド側 newsTags** — ガイドの frontmatter `newsTags:` は **posts の実在タグと一致させる**（表記ゆれ不可）。ニュース枠は該当0件なら自動非表示なので、将来のタグを先置きしてもよい。逆方向（ガイド→posts）は大票田タグを使ってよい（例: single-couple-life は「開店・閉店」を使用）
4. **シリーズ記事の前後リンク** — 子育てステージ4本は末尾の `series-nav` 節（前後＋ハブ＋全ステージ共通2本）を維持する。記事を増やす場合は前後リンクを付け替える

### 記事ルール

- **孤立記事を作らない** — 公開時に必ず「所属ハブ」または既存記事本文からの導線を張る（旅行ガイドと同じ）。`lifeguides.yaml` のカード掲載だけでは不可
- **事実は life_facts に定数化** — 年度改定されうる金額・回数は `data/life_facts.yaml` に置き `{{</* fact "life.xxx" */>}}` で参照。**未確認の値を yaml に置かない**（出典URL＋確認日コメント必須）。現状は骨格のみで、既存記事のリテラル値は改定時に移行する
- **公式の複製にならない** — 一次情報は市公式。当サイトの価値は「横断整理」と「最初の一歩への導線」
- **新設・大改修時は `lifeguides.yaml` の `updates:`（トップの更新帯）に1行追加**する

### 収益ルール（Step 0 決定・永続）

- アフィリエイト設置面は**転入・住まい系のみ**（sumai-hikkoshi・station-life）。表記は PR バッジ＋affiliate-box＋注記の akippa 方式
- **子育て・介護・急病・防災には広告を置かない**（信頼が資産。将来も置かない）
