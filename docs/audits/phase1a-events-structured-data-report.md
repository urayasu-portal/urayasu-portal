# 工程1a PR 4 報告書：イベントカレンダーと Event 構造化データ

- 作成日: 2026-10-05
- ブランチ: `claude/phase1a-events-jsonld`（最新 main `0d7c9d78` から作成。**push・PR 作成・マージ・デプロイはしていない**）
- 設計: `docs/audits/phase1a-events-structured-data-design.md`（設計ブランチ `claude/phase1a-events-design`、未 push）第18〜20章の確定仕様
- 前提の記事修正: PR #17（14本への `eventKind` 付与）を本 PR の前に main へマージ済み
- 判定日（「今日」）: 2026-10-05 JST。件数はすべてこの日で数えた
- 付属データ: [phase1a-events-report-data/](phase1a-events-report-data/)（TSV 8本）

## 1. 結論

1. `/events/` の掲載を「解釈できる開催日がある」かつ「種別 event・match（1件目のカテゴリ「イベント」からの推定を含む）または `calendar: true`」に変えた。開催予定・開催中は **70本 → 55本**（継続42・追加13・除外28）
2. Event 構造化データ（JSON-LD）は「種別 event・match」かつ「**`eventLocation` を明示**」の記事だけに出すよう変えた。出力ページは **376 → 1**（浦安市花火大会2026）。根拠のない「浦安市」の会場・主催者・住所は **376 → 0**、市外の記事への出力は **21 → 0**
3. 意図した差分は `/events/`・Event JSON-LD・`post-rules.js`（検証）・CSS（追加3ルール。全ページの CSS ハッシュが変わる）だけ。それ以外の差分は **0**（第7章）
4. テストはすべて通過（ルール 103/103、日付部品 86/86、新設のイベント部品 25/25、本番相当ビルドの検証で新しい不備 0、内部リンク切れ 0）

## 2. PR #17 のマージと本番確認

| 項目 | 結果 |
|---|---|
| マージ | 通常のマージコミット `0d7c9d78`。`lastmod` は変更なし |
| デプロイ | validate・build・deploy すべて成功（2026-10-05 08:23 UTC） |
| `eventKind` | 14本すべてに反映（match 5・event 9） |
| 記事カード | match の5本は「試合日」、event の9本は「開催」 |
| `/daily/` | 14本の日付バッジが種別どおりに変化 |
| `/events/`・Event JSON-LD | 変化なし（PR 4 前のため） |
| URL・canonical・hreflang・本文・sitemap・アフィリエイト | 変化なし（本番29ページがローカルビルドとバイト一致） |
| D-Rocks「浦安Dパークでプレシーズン戦を有観客開催」 | 判断保留のまま `eventKind` なし。本 PR でも変更せず、match 扱いしていない（`/events/` に載らない。1件目のカテゴリはスポーツで推定もしない） |

## 3. 実装の概要

| ファイル | 変更 |
|---|---|
| `layouts/partials/event-calendar-eligible.html`（新） | `/events/` の掲載判定（真偽を返す） |
| `layouts/partials/event-calendar-status.html`（新） | 全日程からの状態（開催予定・開催中・終了）、表示する期間、並び順キー |
| `layouts/partials/event-jsonld-eligible.html`（新） | Event JSON-LD の出力判定。カレンダーの判定とは**別の部品**で、互いを呼ばない |
| `layouts/partials/event-jsonld.html` | 全面改修（第5章） |
| `layouts/_default/events.html` | 掲載・状態・1記事1行の表示・並び順を改修（第4章） |
| `assets/css/extended/custom.css` | `.ev-kind`（「試合」の印）・`.ev-sched`（日程の要約）の3ルールを追加 |
| `static/tools/post-rules.js` | `eventLocation`・`organizer` の検証を追加（第6章）。投稿ツールの HTML は変更不要だった（既存の項目別表示にそのまま載る） |
| `scripts/validate/test/run-tests.mjs` | 検証のテスト8件を追加 |
| `scripts/validate/test/events-hugo.mjs`（新） | 最小の Hugo サイトで22記事分を確かめるテスト |
| `.github/workflows/pr-check.yml` | 上のテストを Pull Request 時に実行（本番の `hugo.yml` の validate・build・deploy の依存関係は変更なし） |
| `scripts/validate/README.md`・`CLAUDE.md` | 規則と用途の更新 |

日付の解釈は PR 3 の共通部品 `event-dates.html`、日程の文章は `event-dates-text.html` をそのまま使った（新しい解釈は作っていない）。

## 4. `/events/`（イベントカレンダー）

### 4.1 掲載条件

上から順に判定する。解釈できる開催日（`eventDate`・`eventDates`）が無い記事は、どの場合も載らない。

| 条件 | 掲載 |
|---|---|
| `calendar: false` | 載せない |
| `calendar: true` | 載せる（fair・種別なしも） |
| `eventKind: event`／`match` | 載せる |
| `eventKind` なし＋1件目のカテゴリ「イベント」 | 載せる（従来どおりの推定） |
| それ以外（fair、種別なしのほかのカテゴリ） | 載せない |

- ほかのカテゴリ（スポーツ・グルメ・開店・閉店など）からは推定しない
- `calendar` は種別を書き換えない（`calendar: true` の fair はカレンダーには載るが、種別は fair のまま。Event JSON-LD も出ない）
- `notableDate(s)`・`shopDate` は使わない（`calendar: true` でも開催日が無ければ載らない）
- fair 専用の欄は作っていない

### 4.2 状態と表示

- **状態は全日程で判定する**。未来の日程が1つでも残る間は「終了」にしない（旧版は先頭の `eventDate` だけを見ていた）
  - 今日を含む日程がある → 開催中（日付欄はその期間。複数あれば終了日の近いもの）
  - 無ければ、次の日程がある → 開催予定（日付欄は次の日程）
  - どちらも無い → 終了（過去の一覧へ。全日程の最終日の新しい順に30本、日付欄は初日。旧版は先頭の日付の新しい順）
- `eventOngoing: true`（終了日未定）は、開始前は開催予定、開始日以降は開催中。終了日を推測しない（「〜」だけを表示し「終了日未定」と添える）
- **1記事1行**。2日程以上の記事は「日程：」として全体を PR 3 の部品で要約する（2〜3日程は列挙、4日程以上は「初日ほか全N日程」）
- 開催中の並び順は終了日の近い順。終了日未定は開催中の末尾
- match には「試合」の印を付ける（記事カードの「試合日」と同じ色）
- 年をまたぐ終了日は年を付けて表示する（例: `7/24(金)〜2027/3/31(水)`。旧版は `3/31` と年が無かった）
- 「今日」の算出を `now.UTC.Add 9h` に直した。旧版の `now.Add 9h` は、ローカル（JST の PC）でビルドすると15時以降に翌日扱いになっていた。本番（GitHub Actions は UTC）の動作は変わらない

### 4.3 改修前後（判定日 2026-10-05）

改修前は main `0d7c9d78` の旧テンプレートの処理を同じ判定日で再現して数えた。

| | 改修前 | 改修後 |
|---|---:|---:|
| 開催予定・開催中 | 70 | 55 |
| うち開催中 | 27 | 14 |
| うち開催予定 | 43 | 41 |
| 過去の一覧 | 30 | 30 |

| 変化 | 本数 | 内訳 |
|---|---:|---|
| 継続 | 42 | 開催中→開催中 10、開催予定→開催予定 32 |
| 追加 | 13 | `eventDates` だけの記事 12（種別なし＋イベント 6、event 3、match 3）、`eventOngoing` 1（リトルマーメイド。旧版は開始日で終了扱い） |
| 除外 | 28 | すべて種別なし: グルメ・カフェ 17、開店・閉店 5、お知らせ 4、子育て・教育 1、ニュース 1 |

改修後55本の内訳: 種別なし＋イベント 41、event 9、match 5。`eventDates` だけの記事 12、`eventOngoing` 1、「日程：」の要約付き 11。

追加・除外の全件（URL・タイトル・理由）は `events-added.tsv`・`events-removed.tsv`、全体は `events-before-after.tsv`。

### 4.4 表示の確認

- PC（1280px）とスマートフォン（375px）で確認。どちらも横スクロールなし（375px でのはみ出しは既存のナビのタブだけで、従来どおり）。1280px では85行（開催予定・開催中55＋過去30）すべて1〜2行に収まる
- 「開催中」の印14件、「試合」の印5件、「日程：」11件と「終了日未定」1件が表示される
- 開催中の並び: パネル展（10/9まで）が先頭、リゾートライン（2027/3/31まで）が終了日のある記事の最後、リトルマーメイド（終了日未定）が末尾

気づいた点（データどおりの動作で、本 PR では変えていない）:

- 4日程以上の要約は全日程の初日から書く（PR 3 の部品の仕様）。日付欄が次の日程でも、要約は過去の初日から始まる（例: 夏祭り・秋祭りまとめは日付欄 10/10、要約「10月3日(土)ほか全7日程」）
- 年をまたぐ期間の行は、スマートフォンで日付欄が広くなりタイトル欄が狭くなる（該当は開催中2本・開催予定1本）

## 5. Event 構造化データ（JSON-LD）

### 5.1 出力条件と内容

| 項目 | 内容 |
|---|---|
| 対象 | posts の記事で、解釈できる開催日があり、種別が event・match（1件目のカテゴリ「イベント」からの推定を含む）で、`eventLocation` が空でない文字列 |
| 使わないもの | `calendar`（カレンダーの掲載とは独立）、本文・タイトル・カテゴリからの会場の推測 |
| 会場 | `location` は `Place` の `name` だけ（`eventLocation` の値）。**住所は出さない** |
| 主催者 | `organizer` が空でない文字列のときだけ |
| 廃止した既定値 | 会場「浦安市」、主催者「浦安市」、住所「浦安市・千葉県」 |
| 日付 | 共通の解釈だけを使う。単日は `startDate` だけ、期間は `startDate`・`endDate`、終了日未定は `startDate` だけ。生の `"開始/終了"` は出さない。解釈できない値は除く |
| 複数日程 | 表示用の日程ごとに1つの Event（最大10件）。同じ日程は1回だけ。`@id` を `記事URL#event-1` のように分ける |
| 料金 | `eventFee` があるときだけ `offers`。`price` は「無料」のときだけ `"0"`（旧版は「500円」などの文字列を `price` に入れていた）。現在 `eventFee` を持つのは花火大会の1本だけ |
| `eventEndDate` | 読まなくした（使っている記事は0本。終了日は `eventDate` の期間で書く） |
| 出力方法 | 文字列の手組みをやめ、`dict` → `jsonify` で生成する（引用符などのエスケープ漏れが起きない） |

### 5.2 改修前後

| | 改修前 | 改修後 |
|---|---:|---:|
| Event を出すページ | 376（ja 364・en 6・zh-tw 6） | 1 |
| Event の数 | 376 | 1 |
| 1ページの最大 Event 数 | 1 | 1 |
| 複数 Event のページ | 0 | 0（実データに該当なし。複数日程はテストで確認） |
| 会場「浦安市」（根拠なし） | 375 | 0 |
| 主催者「浦安市」（根拠なし） | 375 | 0 |
| 住所（浦安市・千葉県） | 376 | 0 |
| 市外（行徳・妙典・南行徳）の記事 | 21 | 0 |

消える375ページの理由:

| 理由 | ページ数 |
|---|---:|
| 会場 `eventLocation` の明示なし（種別は event・match） | 147（種別なし＋イベント 139、event 6、match 2） |
| 種別が event・match でない | 228（スポーツ 72、開店・閉店 64、グルメ・カフェ 31、お知らせ 30、子育て・教育 15、ニュース 4、翻訳版 12） |

開店・閉店・お知らせ・ニュース・市外・fair の記事から Event が消えたことを全件で確認した（`jsonld-removed.tsv`）。

残る1ページ（浦安市花火大会2026）の出力: `startDate` 2026-10-17（旧版は同じ日の `endDate` も出していた）、会場「浦安市総合公園・高洲海浜公園」、主催者「浦安市・浦安市ふるさとづくり推進協議会」、住所なし、料金「無料」（`price` 0）。

全件は `jsonld-before-after.tsv`・`jsonld-removed.tsv`・`jsonld-remaining.tsv`・`jsonld-multi-event.tsv`（見出しだけ）・`location-organizer-audit.tsv`。

### 5.3 今後への影響

- Event JSON-LD は、記事化プロンプトの Stage B で `eventLocation`（と任意で `organizer`）を出力するまで、ほぼ出ない状態になる。誤った会場・住所を出し続けるより安全側を選んだ確定仕様どおり
- 既存記事へ `eventLocation` を後から足せば、その記事から出る（記事修正 PR の対象。本 PR では記事を変更していない）

## 6. `eventLocation`・`organizer` の検証

どちらも任意項目。無いことは警告にしない。

| 区分 | コード | 内容 |
|---|---|---|
| エラー | `EVENTLOCATION_NOT_STRING`・`ORGANIZER_NOT_STRING` | 文字列でない（リスト・真偽値・数値・`null`。引用符なしの `123`・`yes`・`no`・`on`・`off` も含む） |
| エラー | `EVENTLOCATION_EMPTY`・`ORGANIZER_EMPTY` | 空・空白だけ |
| 警告 | `…_UNCONFIRMED` | 「未定」「未発表」「不明」「未確定」「調整中」「確認中」「要確認」「TBD」「TBA」「TBC」を含む |
| 警告 | `…_LONG` | 80文字を超える |

- 更新時の互換: 値を変えていない項目のエラーは警告に下げる（開催日・新項目と同じ仕組みに加えた）。既存ファイルを読めない場合の警告 `EVENT_PREV_UNAVAILABLE` の対象にも加えた
- 既存記事でこの2項目を持つのは各1本（花火大会）で、不備は無い
- 投稿ツールの HTML は変更していない（項目別のメッセージ表示にそのまま載る）

## 7. 回帰確認

本番と同じ条件（Hugo 0.167.0 extended・`--minify`・Pagefind 1.5.2、`git archive` した木）で main `0d7c9d78` と PR 4 をビルドし全数比較した。

| 項目 | 結果 |
|---|---|
| 全 HTML の差分 | 差分のある2924ファイルのうち2922は Event JSON-LD と CSS ハッシュだけ。残る2つは意図した `events/index.html` と `tools/post-rules.js`。**それ以外の差分 0** |
| ページ一覧・タイトル・canonical・robots・hreflang・h1 | 全ページ一致 |
| 記事本文・URL | 一致 |
| 記事カード・`/daily/`・サイドバー・開店・閉店年表 | 一致 |
| sitemap の URL | 一致 |
| アフィリエイトのリンク（723） | 一致 |
| aliases | 一致 |
| 投稿ツールの画面（`post-tool.html`） | 一致 |
| Pagefind | 2924ページ（変化なし） |
| ビルド時間 | 約6.4秒（変化なし） |

テスト:

| テスト | 結果 |
|---|---|
| `run-tests.mjs`（全件／`--unit-only`） | 103/103／98/98 |
| `event-dates-hugo.mjs`（PR 3） | 86/86 |
| `events-hugo.mjs`（新設） | 25/25（約0.4秒） |
| `validate-content.mjs`（本番相当ビルド） | 新しい不備 0 |
| 不正な日付19通りでのビルド | main・PR 4 とも19通りすべてビルド成功。PR 4 では不正な日付の記事を `/events/` と JSON-LD から除く |
| 内部リンクの到達 | リンク切れ 0 |

`events-hugo.mjs` の22記事: 単日・期間（開催中）・終了日の近い期間・`eventDates` だけ（2つの Event と `@id`）・複数回・一部終了・全終了・終了日未定（開始前／開始後）・match（印）・fair（除外・JSON-LD なし）・スポーツの種別なし（除外）・子育ての種別なし（除外）・`calendar: true` の fair（掲載・JSON-LD なし）・`calendar: false` の event（除外・JSON-LD あり）・`calendar: true` で `notableDate` だけ（除外）・不正な日付・主催者あり・同じ日程の重複（Event 1つ）・会場なしの市外記事・空の会場・開店記事。開催中・開催予定の並び順も確かめる。

テストが条件の欠落を検出することも確かめた（会場の条件を外すと5件失敗、fair を含めると1件失敗し、終了コード1）。

## 8. 範囲外（変更していないもの）

- **記事化プロンプト**: v20261005β のまま変更していない。Stage B（PR 4 の後）で検討する事項:
  - `eventLocation`（会場名だけ。未定なら書かない）と任意の `organizer` の出力
  - `eventKind` の出力（試合は `match`。スポーツ記事でも試合でなければ付けない）
  - fair を `/events/` に載せたい記事だけ `calendar: true`
- **PR 5 との境界**: `shopStatus`・`shopDate`・`shopUnconfirmed`、開店・閉店年表、件数の表示には触れていない
- **記事**: 本 PR で記事は変更していない（`lastmod` の更新なし）。D-Rocks のプレシーズン戦の記事は判断保留のまま
- `CLAUDE.md` の「記事化プロンプト v20260907」の記述は、プロンプトの切り替え状況を本 PR で確認していないため変更していない

## 9. 付属データ（`phase1a-events-report-data/`）

| ファイル | 内容 |
|---|---|
| `events-before-after.tsv` | `/events/` の開催予定・開催中、改修前後の全83本（状態・変化・理由・改修後の行） |
| `events-added.tsv` | 新しく載る13本 |
| `events-removed.tsv` | 外れる28本 |
| `jsonld-before-after.tsv` | Event JSON-LD の改修前後（ページ単位、376） |
| `jsonld-removed.tsv` | 消える375ページと理由 |
| `jsonld-remaining.tsv` | 残る1ページ |
| `jsonld-multi-event.tsv` | 複数 Event のページ（改修後 0。見出しだけ） |
| `location-organizer-audit.tsv` | 会場・主催者・住所の改修前後、市外の印 |

## 10. 次の手順（運営者の承認待ち）

1. 本ブランチの push と Pull Request の作成（PR Check で新しいテストが動くことを確認）
2. main へのマージと本番確認（`/events/` の件数と並び、花火大会の JSON-LD、リッチリザルトテスト）
3. 記事化プロンプトの Stage B
