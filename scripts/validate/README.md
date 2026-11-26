# 記事データの検証（scripts/validate）

2026-10-04（工程0.5）に導入。slug の使い回しで旧記事が本番から消えた事故（10本）の再発防止と、frontmatter の不備を早く見つけるための仕組み。

## 構成

| ファイル | 役割 |
|---|---|
| `static/tools/post-rules.js` | **検証ルールの単一ソース**。投稿ツール（ブラウザ）と CI（Node）の両方が読む。外部ライブラリなし |
| `static/tools/post-tool.html` | 投稿ツール。投稿前に post-rules.js で検証し、既存記事との URL 重複を GitHub API と公開ページで確認する |
| `scripts/validate/validate-content.mjs` | CI 用。全記事を検証し、Hugo が実際に作る URL（`hugo list all`）で衝突を調べる |
| `scripts/validate/post-checks.mjs` | CI だけの追加検査（P0-B）。公開されない date・新規記事の必須項目・出典と広告リンク・本文のリンク・重複記事・URL 衝突の説明（下の「日次 posts の追加検査」） |
| `scripts/validate/known-issues.json` | **既存の不備リスト**。ここに載っている不備は失敗にしない（新しい不備だけを失敗にする） |
| `scripts/validate/test/run-tests.mjs` | ルールのテスト（BOM・CRLF・インライン配列・日付・衝突など）と既存記事の回帰テスト |
| `scripts/validate/test/event-dates-hugo.mjs` | 表示側の日付解釈（`layouts/partials/event-dates.html` ほか、工程1a PR 3）のテスト。最小の Hugo サイトで85通りを確かめる。Hugo が必要。`pr-check.yml`（Pull Request 時）で実行する |
| `scripts/validate/test/open-close-hugo.mjs` | 開店・閉店年表と店舗の状態（工程1a PR 5）のテスト。最小の Hugo サイトで47記事分（10種類の状態・年月日／年月／日付なし・状態変化の年（yaml の `year`）・予定日経過・yaml の上書きと `count: false`・legacy のタイトル分類）を確かめ、`/daily/` の文言（生成された script を実行）・サイドバーの点灯・`/events/` と Event JSON-LD に入らないこと・日本時間の境目も確かめる。Hugo が必要。`pr-check.yml` で実行する |
| `scripts/validate/test/events-hugo.mjs` | イベントカレンダー（`/events/`）の掲載・状態・並び順と Event 構造化データ（工程1a PR 4）のテスト。最小の Hugo サイトで25記事分を確かめ、判定する時刻を固定して日本時間の日付の境目（0時・15時・23時59分・年の境目、環境変数 TZ を4通り）も確かめる。Hugo が必要。`pr-check.yml`（Pull Request 時）で実行する |
| `.github/workflows/hugo.yml` の `validate` ジョブ | push・schedule・手動実行のたびに上記を実行 |
| `.github/workflows/pr-check.yml` | Pull Request 時にビルド（本番と同じオプション）・Pagefind・検証を実行。**デプロイはしない**。Hugo／Pagefind の版は hugo.yml と揃える |

## ルール（新規記事）

| 区分 | 内容 |
|---|---|
| エラー（投稿ブロック／CI 失敗） | frontmatter の `---` 区切りが無い・書式の誤り（閉じていないクォート、項目の重複、タブ字下げ等）／`title` 無し／`date` 無し・形式不正・存在しない日時／`slug` 無し（`url:` 指定があれば可）・形式不正（半角英小文字・数字・ハイフン）／`categories` 無し（ja のみ）・許可外の値（ブロック形式・インライン形式の両方）／`draft: false` 無し／`eventDate` があるのに `hideEventBox: true` 無し／**既存記事と URL（slug・url・aliases）が重複**／**開催日（`eventDate`・`eventDates`）の形式・実在性**（下表） |
| 警告（投稿は続行可） | 未来の `date`（予約投稿。30日より先は誤入力の可能性として強めに警告）／`date` にタイムゾーン無し（UTC 扱い＝日本時間で9時間ずれる）／ファイル名の日付と `date`（日本時間）の不一致／開催日の非推奨の書き方（下表）／lastmod の付け忘れ・付けすぎ／本文の注意点（短い・iframe 等） |
| 既存記事の更新 | `slug` が無い記事（ファイル名から URL が決まる176本）はそのまま更新できる。`slug` を変えると URL が変わる旨を警告する。開催日のエラーは、その項目を追加・変更した場合だけ適用する（下記） |

予約投稿（未来の `date`）は**禁止していない**。投稿ツールは公開予定時刻（日本時間）を表示し、確認を求める。

### 開催日（`eventDate`・`eventDates`）の検証（工程1a PR 1a-1）

値の**形式と実在性**だけを検証する。どのカテゴリの記事に付けるかは問わない（記事化プロンプト v20260907 では `eventDate` は「注目の日」で、開店日・閉店日・試合日などにも使う）。

書式: `eventDate: "YYYY-MM-DD"`（単日）／`"YYYY-MM-DD/YYYY-MM-DD"`（連続期間）。終了日未定は単日＋`eventOngoing: true`。`eventDates` はリストで、要素は単日または期間。

| 区分 | コード | 内容 | 理由 |
|---|---|---|---|
| エラー | `EVENTDATE_INVALID`／`EVENTDATES_INVALID` | 存在しない日付（2月30日・13月・平年の2月29日） | `eventDate` は Hugo のビルドが止まる（終了通知の time 関数）。`eventDates` も同じ規則で揃える（将来カレンダーで読むため） |
| エラー | `…_FORMAT` | 日付として読めない値（日本語・`2026/10/01`・全角・真偽値） | 同上 |
| エラー | `…_SPACED` | 値の前後や、期間の区切り「/」の前後に空白 | 同上（2026-10-05 に Hugo 0.167.0 で確認） |
| エラー | `…_SEPARATOR` | 「〜」「～」「~」「,」「、」による区切り | 同上 |
| エラー | `EVENTDATE_RANGE_NOT_ALLOWED` | `eventDate` のリストの要素に期間 | 同上 |
| エラー | `EVENTDATES_NOT_LIST` | `eventDates` がリストでない | `/daily/` でビルドが止まる |
| エラー | `…_REVERSED` | 期間の終了日が開始日より前 | カレンダー・構造化データが誤る |
| エラー | `…_TOO_MANY_PARTS` | 区切り「/」が2つ以上 | 同上 |
| エラー | `…_EMPTY` | 空の値・空のリスト・リスト内の空要素 | 誤入力 |
| 警告 | `EVENTDATE_ARRAY` | `eventDate` がリスト（既存2本） | 表示は保てる。複数日程は `eventDates` へ |
| 警告 | `EVENTDATES_SINGLE`／`_UNSORTED`／`_DUPLICATE` | 1件だけ・日付順でない・重複 | 表示は保てる |
| 警告 | `EVENT_BOTH` | `eventDate` と `eventDates` の併用（同じ日付なら情報 `EVENT_BOTH_SAME`） | カレンダーは `eventDate` だけを使う |
| 警告 | `…_HAS_TIME` | 時刻付き | 時刻は使われない |
| 警告 | `EVENTONGOING_WITH_RANGE`／`EVENTONGOING_NO_DATE` | `eventOngoing: true` と期間の併用／`eventDate` が無い | 終了日判明時は `eventOngoing` を削除 |
| 情報 | `EVENTDATES_CONSECUTIVE`・`…_SAME_DAY` | 連続した日だけの `eventDates`（既存44本）、開始日と終了日が同じ期間 | 正しいデータ。投稿ツールには表示しない |

- **更新との互換**: 投稿ツールは既存ファイル（GitHub から取得した全文）と比べ、開催日を**追加・変更した項目だけ**にエラーを適用する。値を変えていない項目のエラーは警告に下げる（続報の全文置換・lastmod だけの更新を止めない）。既存ファイルの内容を読めない場合は、新規と同じ基準で検証して警告を出す（推測で復元しない）
- **CI**: 全記事を新規と同じ基準で検証する（main へ直接コミットされた不正な値も検出する）。既存記事に該当は無い（2026-10-05 時点、開催日を持つ 465 本）ため、`known-issues.json` への追加は無い
- `eventOngoing: true` の記事で終了日が無いことはエラーにしない。カテゴリやタイトルから終了日の要否を推測しない

### 新しい日付・店舗情報の項目の検証（工程1a PR 1a-2）

項目を**受け入れて形式を検証するだけ**。すべて任意項目で、無いことは警告にしない。カテゴリとの組み合わせ（例: 開店・閉店記事の `eventDate`）も検証しない。表示への反映は後続の PR（定義と表示の状況は CLAUDE.md）。

| 項目 | 許可する値 | エラー |
|---|---|---|
| `eventKind` | `event`／`match`／`fair` | `EVENTKIND_INVALID`（それ以外の値・空・真偽値） |
| `notableDate` | `"YYYY-MM-DD"`（単日。期間・時刻・リストは不可） | `NOTABLEDATE_FORMAT`・`_INVALID`・`_EMPTY`・`_SPACED`・`_SEPARATOR`・`_RANGE_NOT_ALLOWED` |
| `notableDates` | `"YYYY-MM-DD"` のリスト | `NOTABLEDATES_NOT_LIST`（文字列だと Hugo のサイドバーでビルドが止まる）・`_EMPTY`・要素ごとの `_FORMAT`・`_INVALID` 等 |
| `shopStatus` | `open`／`open_planned`／`close`／`close_planned`／`temp_close`／`reopen`／`renewal`／`move`／`feature`／`popup`（PR 5 で追加） | `SHOPSTATUS_INVALID` |
| `shopDate` | `"YYYY-MM-DD"` または `"YYYY-MM"`（年月だけ。月初・月末に読み替えない） | `SHOPDATE_FORMAT`・`_INVALID`（13月・2月30日等）・`_EMPTY` |
| `shopUnconfirmed` | 真偽値 `true`／`false`（引用符なし） | `SHOPUNCONFIRMED_NOT_BOOLEAN`（`"true"` は文字列なのでエラー） |
| `calendar` | 真偽値 `true`／`false`（引用符なし） | `CALENDAR_NOT_BOOLEAN` |

警告は `NOTABLEDATES_UNSORTED`（日付順でない）・`NOTABLEDATES_DUPLICATE`（重複）だけ。更新時は開催日と同じく、追加・変更した項目だけにエラーを適用し、値を変えていない項目のエラーは警告に下げる。既存記事で新項目を持つのは `notableDate` の1本だけで、該当する不備は無い（2026-10-05 時点）。

### 会場・主催者（`eventLocation`・`organizer`）の検証（工程1a PR 4）

Event 構造化データは `eventLocation` が書かれた記事にだけ出し、その値をそのまま会場名にする（`organizer` も書かれた場合だけ出す）。推測で補わないため、値の誤りがそのまま検索エンジンに渡る。どちらも任意項目で、無いことは警告にしない。

| 区分 | コード | 内容 |
|---|---|---|
| エラー | `EVENTLOCATION_NOT_STRING`・`ORGANIZER_NOT_STRING` | 文字列でない（リスト・真偽値・数値・`null`。引用符なしの `123`・`yes`・`no`・`on`・`off` も含む） |
| エラー | `EVENTLOCATION_EMPTY`・`ORGANIZER_EMPTY` | 空・空白だけ |
| 警告 | `EVENTLOCATION_UNCONFIRMED`・`ORGANIZER_UNCONFIRMED` | 「未定」「未発表」「不明」「未確定」「調整中」「確認中」「要確認」「TBD」「TBA」「TBC」を含む |
| 警告 | `EVENTLOCATION_LONG`・`ORGANIZER_LONG` | 80文字を超える（会場名・主催者名だけを書く） |

更新時は開催日と同じく、値を変えていない項目のエラーは警告に下げる。既存記事でこの2項目を持つのは各1本（浦安市花火大会2026）で、不備は無い（2026-10-05 時点）。

### 店舗の状態の整合（工程1a PR 5）

形式（語彙・`shopDate`・`shopUnconfirmed`）のエラーは上の表のとおり。食い違いは警告だけ（投稿・公開は止めない）。日付は日本時間。

| コード | 内容 |
|---|---|
| `SHOPSTATUS_MISSING` | 「開店・閉店」カテゴリの新規記事に `shopStatus` が無い。`date` が `SHOP_STATUS_FROM`（2026-10-07）以降の記事だけ（それより前の既存記事は年表が yaml・タイトルから分類するので警告しない）。更新は対象外 |
| `SHOP_FIELDS_WITHOUT_STATUS` | `shopDate`・`shopUnconfirmed` があるのに `shopStatus` が無い |
| `SHOP_CONFIRMED_FUTURE` | `open`・`close`（確認済み）なのに `shopDate` が未来（年月は翌月以降）。予定なら `open_planned`・`close_planned` |
| `SHOP_PLANNED_PASSED` | `open_planned`・`close_planned` の予定日を過ぎた（日付は翌日から、年月はその月が終わってから）。CI では Summary の「店舗の予定日経過・未確認」に一覧で出す |
| `SHOP_UNCONFIRMED_FEATURE` | `feature`（まとめ）に `shopUnconfirmed: true` |

`data/openclose.yaml`（年表のキュレーション）も CI が検証する: `status`・`type` の語彙外・`date` の形式不正（`OPENCLOSE_STATUS_INVALID`・`OPENCLOSE_DATE_INVALID`）、`unconfirmed`・`count` が真偽値でない（`OPENCLOSE_BOOL`）、`year` が "YYYY" でない（`OPENCLOSE_YEAR_INVALID`）はエラー。記事の無いキー（`OPENCLOSE_ORPHAN`）、`year` と `date` の年の食い違い（`OPENCLOSE_YEAR_MISMATCH`）は警告。`status` が予定で `date` を過ぎたものは「店舗の予定日経過・未確認」に出す。

### 日次 posts の追加検査（P0-B、2026-11-01）

記事は別環境から main へ直接 push されるため、品質の確認は CI だけが頼り（pre-commit フックは投稿元で動かない）。
`static/tools/post-rules.js` が見ていない項目を `scripts/validate/post-checks.mjs`（CI 専用）に追加した。post-rules.js は `static/` 配下で公開サイトにも出力されるため変更していない（投稿ツールの挙動・公開サイトは不変）。同じ不備を二重に報告しないよう、既存ルールにある検査は足していない。

**既存記事の扱い（legacy 例外）**: 新規記事向けのルールは、`date`（日本時間の日付）が `STRICT_FROM`（**2026-11-01**）以降の記事だけに適用する。それより前の記事には出さない（内部リンク切れ・期限切れだけは警告）。`date` が読めない記事は新規扱い。
差分（このコミットで変わった記事）ではなく日付で区別しているのは、`validate` ジョブが浅い clone で動き、ワークフローを変えずに確実な差分が取れないため。既存記事を後から書き換えた場合は厳格ルールの対象にならない（下表の「全記事」の項目は対象）。
2026-11-01 時点で既存 896 本への影響は**エラー 0 件**（開始日を設けず全記事に適用すると `DESCRIPTION_MISSING` 169・`TAGS_MISSING` 169 本＝初期の記事。`run-tests.mjs` の回帰テストで毎回表示）。

| 区分 | コード | 対象 | 内容 |
|---|---|---|---|
| エラー | `FM_LEADING_WHITESPACE` | 全ファイル | 1行目の `---` より前に空行・空白（「1行目より前に空白があります」）。Hugo は読み飛ばして公開するが、post-rules.js は `FM_NO_START` と誤った原因を出し、ほかの検査がすべて止まっていた。空白を除いて残りの検査を続ける |
| エラー | `DATE_NOT_PUBLISHED` | 全記事 | `date`（`publishDate` があればそちら）が検証時刻より未来で、その日付（日本時間）が今日以前（「date が公開時刻より未来です（buildFuture なしのため公開されません）」）。下の「CI での意味」参照 |
| エラー | `PUBLISHDATE_FORMAT`・`EXPIRYDATE_FORMAT` | 全記事 | `publishDate`・`expiryDate` が日時として読めない |
| エラー（既存は警告） | `EXPIRYDATE_PASSED` | 全記事 | `expiryDate` を過ぎて公開されない（`buildExpired` なし） |
| エラー | `DESCRIPTION_MISSING` | 新規 | `description` が無い・空 |
| エラー | `TAGS_MISSING`・`TAGS_FORMAT` | 新規（ja） | `tags` が無い・空・リストでない（guide_map.yaml のガイドカード連携のため） |
| エラー | `SHOPSTATUS_MISSING`・`SHOP_FIELDS_WITHOUT_STATUS`・`SHOP_CONFIRMED_FUTURE` | 新規 | post-rules.js の警告を**エラーに昇格**（同じコード・同じ文言＋注記）。2026-10-07〜10-31 の記事は従来どおり警告。`SHOP_PLANNED_PASSED`（時間の経過で必ず起きる）は昇格しない |
| エラー | `LASTMOD_FORMAT`・`LASTMOD_BEFORE_DATE` | 新規 | `lastmod` が読めない・`date` より前の日 |
| 警告 | `LASTMOD_FUTURE` | 新規 | `lastmod` が今日（日本時間）より先 |
| 警告 | `EVENTKIND_WITHOUT_DATE` | 新規 | `eventKind` があるのに `eventDate`・`eventDates` が無い（`eventKind` の値の検査は post-rules.js の `EVENTKIND_INVALID`） |
| 警告 | `EVENT_ENDED_BEFORE_POST`・`EVENT_FAR_AFTER_POST` | 新規 | 開催日の最終日が `date` より30日以上前／開始日が1年以上先（年・月の誤入力の疑い。`eventOngoing: true` は前者の対象外） |
| エラー | `SOURCES_AFFILIATE` | 新規 | 出典（`sources` の `url`）が広告リンク（A8・バリューコマース・もしも・楽天・Travelpayouts 等、または Trip.com の `Allianceid` などの提携パラメータ付き） |
| エラー | `SOURCES_URL_INVALID`・`SOURCES_FORMAT` | 新規 | 出典の url が http(s) でない／文字列だけのリスト・name も url も無い（name だけの資料は可） |
| エラー | `LINK_EMPTY`・`LINK_PLACEHOLDER` | 新規 | 本文の空リンク（`href=""`・`#`・`[x]()`）・仮の URL（localhost・example.com 等） |
| エラー（既存は警告） | `LINK_INTERNAL_BROKEN` | 全記事 | 本文の内部リンク（`/…`・`https://urayasu-portal.com/…`）が `hugo list all` のページにも aliases にも無い／static の画像・PDF が無い。タクソノミー（`/tags/`・`/categories/`）と ref・relref は対象外 |
| 警告 | `AFFILIATE_LINK_IN_POST` | 新規 | 本文に広告リンク（PR 表記の要否と、出典と分けることの確認） |
| エラー | `DUPLICATE_TITLE`・`DUPLICATE_BODY` | 新規 | 同じ言語の他の記事とタイトルが同じ／本文がほぼ同じ（4文字単位の一致率 0.9 以上） |
| 警告 | `SIMILAR_POST` | 新規 | タイトル（【】の地域名を除く）の一致率 0.85 以上、または本文 0.6 以上。既存記事どうしの類似は出さない（2026-11-01 時点、開始日なしで 16 組） |

**URL 衝突（slug・url・aliases の重複）の文言**: 検出の仕組みは従来どおり（Hugo の実 URL＋aliases、`known-issues.json` との照合）。新しい衝突は、後から加わったファイルごとに「slug が既存記事（content/posts/xxx.md）と重複しています（URL: …）」と、続報向けの slug 案（`<元の slug>-<YYYYMMDD>`、使用中なら `-2` …。使用中の URL と照合済み）を出す。どちらが既存記事かは、既知の衝突ならそのファイル、そうでなければ `date` の古い方。

**`DATE_NOT_PUBLISHED` の CI での意味**: `validate` ジョブは push の直後に動くので、検証時刻 ≒ push 時刻 ≒ 本番ビルドの時刻。`date` がそれより未来の記事はそのビルドから落ち、次に公開されるのは schedule（不安定）か手動実行のとき。
- **エラー**: push（とローカル実行）で、`date` の日付が今日以前（当日の記事を未来の時刻で書いた＝旧 22:00 ルールの事故）。失敗通知が「記事が反映されない」ことの早期警報になる
- **通知のまま**: 翌日以降の日付は従来どおり「予約投稿」（post-rules.js の `DATE_FUTURE`）。CLAUDE.md の「意図的な予約投稿」はこちら
- **警告に下げる**: `pull_request`（マージ時刻が未定）・`schedule`・`workflow_dispatch`（予約投稿の当日の再ビルドで誤ってエラーにしないため）
- 2026-11-01 時点で該当する既存記事は 0 本

## CI の動き（公開は止めない）

### 「検知・通知」と「公開ブロック」の区別

**CI の検証（`validate` ジョブ）は「検知・通知」だけで、公開は止めない。** エラーの記事も、そのまま本番に出る。

| 仕組み | 種類 | 止まるもの | 対象 |
|---|---|---|---|
| `validate` ジョブのエラー（このディレクトリのルール全部。P0-B の追加検査を含む） | **検知・通知** | 何も止めない。`validate` ジョブが失敗するだけ | main への push・schedule・手動実行 |
| `validate` ジョブの警告（`SIMILAR_POST` 等） | 検知のみ | 何も止めない。失敗にもならない（Summary と注釈に出るだけ） | 同上 |
| `pr-check.yml` の検証 | 検知（マージ前） | PR の check が失敗する。マージは止めない（必須チェックの設定なし） | Pull Request だけ。日次 posts は main へ直接コミットされるため**通らない** |
| 投稿ツール（`static/tools/post-tool.html`）のエラー | **公開ブロック**（`post-rules.js` のルールだけ） | ツールからの投稿（GitHub API で main へ直接コミット） | 投稿ツールを使った投稿だけ（日次 posts の大半。単一ファイルの `feat: …` コミット）。git で直接 push した記事には効かない。**P0-B の追加検査（`post-checks.mjs`）はツールに入っていないので、ツールでは止まらない** |
| Hugo のビルド失敗（frontmatter の破損など） | 公開ブロック（意図したものではない） | **その回の公開全体**。本番は前回の内容のまま | 全記事 |
| `date` が未来（buildFuture なし） | 公開されない（Hugo の仕様） | その記事だけ | 全記事。`DATE_NOT_PUBLISHED` はこれを**知らせる**だけで、止めているのは Hugo |

- `validate` ジョブは `build`／`deploy` と**独立**している（`needs` に入れていない）。不備があっても公開は従来どおり進む
- 新しい不備があると `validate` ジョブだけが失敗し、ワークフローの実行が「失敗」になる。Actions の実行結果ページ（Summary）に一覧が出る
- **通知は GitHub の通知設定しだい**: GitHub は、失敗したワークフローを起動したアカウント（日次 posts では push したアカウント）に通知する。メール・Web のどちらに届くか、届くかどうかは、そのアカウントの Settings → Notifications → Actions の設定による（このリポジトリからは確認できない）。届かない設定だと、Actions の画面を見るまで誰も気づかない
- 予約投稿は失敗にせず、Summary に「予約投稿」として一覧表示する（当日の未来時刻は `DATE_NOT_PUBLISHED` として失敗。上の「日次 posts の追加検査」）
- 追加検査の警告は、Summary の「記事の注意」と Actions の注釈（warning）に出す（失敗にはしない）。警告は通知が届かないので、Summary を見ないと気づかない
- frontmatter が壊れて Hugo 自体が失敗した場合（これは以前から公開が止まる）も、`validate` は frontmatter から推定した範囲で検査を続け、壊れているファイルを示す
- 重大なエラーだけを公開前に止める仕組みは**未実装**（後続の課題。下の「将来の選択肢」）

### 失敗したときの対応

1. Actions の該当実行 → `validate` ジョブの Summary を開く
2. 「新しい不備」「新しい URL 衝突」に出ているファイルを直す
   - URL 衝突: **後から追加した記事**（一覧で「（新たに追加）」と表示）の `slug` を変える。続報なら `<元の slug>-<YYYYMMDD>` が目安
   - ほかの不備: メッセージどおりに frontmatter を直す
3. 直したコミットを push すると再検証される。公開済みの内容に問題があった場合はその後のビルドで反映される

### 重複・類似の判定が誤検知だったとき

閾値（`post-checks.mjs` の `BODY_DUP` 0.9・`BODY_SIMILAR` 0.6・`TITLE_SIMILAR` 0.85）は当面変えない（2026-11-01 運営判断）。誤検知はまず記事側で解消し、閾値の変更は記録がたまってから判断する。

| コード | 区分 | まず確かめること | 誤検知だった場合の対応 |
|---|---|---|---|
| `SIMILAR_POST` | 警告（失敗しない） | 同じイベント・店舗の記事を新しく作っていないか。同じなら新記事を作らず、既存記事に追記して `lastmod` を更新する | 続報・別の回など、別記事にする理由があれば**対応不要**。新しい記事の本文から既存記事へリンクを張る（読者が前後を追えるように） |
| `DUPLICATE_TITLE` | エラー | 同じ記事を二重に投稿していないか | 別の年・別の回・続報なら、タイトルに違いを入れる（例:「第2回」「11月の日程」「続報」）。これで解消する |
| `DUPLICATE_BODY` | エラー | 別の記事の本文を誤って貼っていないか（姉妹サイトとの誤混入を含む）。同じ記事の二重投稿ではないか | 定型の告知（毎月の同じ案内など）で本文がほぼ同じになる場合は、その回だけの情報（日程・内容）を本文の冒頭に書く |

- 記事を直せない・直すべきでない場合に限り、`known-issues.json` の `issues` に `"DUPLICATE_TITLE": ["content/posts/xxx.md"]` のように**コードとファイルを追加**すると、そのファイルのそのコードだけ失敗から外せる（ほかのファイル・ほかのコードには効かない）。追加するときは `_readme` に日付と理由を1行書く。無期限の許容リストにしない
- 誤検知だったときは、日付・コード・2つのファイル・類似度（メッセージに出る数値）・理由を `docs/maintenance-log.md` に1行残す。閾値を見直すときの材料にする
- 閾値を変える場合は、別の PR で `post-checks.mjs` の定数を変え、開始日なしで全記事に当てたときの件数（`--strict-from 2000-01-01` で測る。2026-11-01 時点で `SIMILAR_POST` 相当 16 組）を変更前後で比べて PR に書く

### 既存の不備リストの更新

不備を解消すると、Summary に「解消済み（known-issues.json から削除できます）」と出る。該当の行を `known-issues.json` から消してコミットする。
意図的に新しい不備を許容する場合だけ、理由を書いて追加する（無期限の許容リストにしない）。

全面的に作り直す場合:

```bash
hugo list all > /tmp/list.csv
hugo --printPathWarnings --destination /tmp/pub > /tmp/build.log 2>&1
node scripts/validate/validate-content.mjs --hugo-list /tmp/list.csv --hugo-log /tmp/build.log --write-known
```

（`--write-known` は衝突の id・plan を引き継ぐ。書き出し後に差分を確認してからコミットすること）

## ローカルでの実行

Node.js が必要。この PC には Node.js が入っていないが、VS Code に同梱の Electron を Node として使える（追加インストール不要）:

```bash
ELECTRON_RUN_AS_NODE=1 "/c/Users/kadoh/AppData/Local/Programs/Microsoft VS Code/Code.exe" scripts/validate/test/run-tests.mjs
```

正式に使い続けるなら Node.js LTS のインストールを推奨（`node scripts/validate/...` で実行できる）。

表示側の日付解釈のテストは Hugo（本番と同じ 0.167.0）のパスを `HUGO` で渡す（PATH に hugo があれば不要）:

```bash
HUGO=/path/to/hugo ELECTRON_RUN_AS_NODE=1 "/c/Users/kadoh/AppData/Local/Programs/Microsoft VS Code/Code.exe" scripts/validate/test/event-dates-hugo.mjs
HUGO=/path/to/hugo ELECTRON_RUN_AS_NODE=1 "/c/Users/kadoh/AppData/Local/Programs/Microsoft VS Code/Code.exe" scripts/validate/test/events-hugo.mjs
HUGO=/path/to/hugo ELECTRON_RUN_AS_NODE=1 "/c/Users/kadoh/AppData/Local/Programs/Microsoft VS Code/Code.exe" scripts/validate/test/open-close-hugo.mjs
```

## 将来の選択肢（運営判断）

| 方式 | 内容 | 副作用 |
|---|---|---|
| 現在：通知のみ | 不備があっても公開し、validate だけ失敗 | 不正な記事も一旦公開される（投稿ツールでは事前にブロック。git で直接 push した記事は止まらない） |
| 公開前ブロック | `build` に `needs: validate` を足す | 不備が1件でもあるとその後の全記事が公開されない |
| 重大エラーの記事だけ公開から外す（後続課題・未実装） | ビルド前に、重大エラーのある**新規記事だけ**をそのビルドから外し、ほかの記事は公開する。公開済みの記事は外さない | 外した記事は直すまで公開されない。設計は別課題（2026-11-01 時点で未着手） |
| PR 経由の投稿 | 投稿ツールが main ではなくブランチ＋PR を作る | 運用手順が変わる・マージ作業が必要 |
