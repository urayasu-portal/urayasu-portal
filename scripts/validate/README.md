# 記事データの検証（scripts/validate）

2026-10-04（工程0.5）に導入。slug の使い回しで旧記事が本番から消えた事故（10本）の再発防止と、frontmatter の不備を早く見つけるための仕組み。

## 構成

| ファイル | 役割 |
|---|---|
| `static/tools/post-rules.js` | **検証ルールの単一ソース**。投稿ツール（ブラウザ）と CI（Node）の両方が読む。外部ライブラリなし |
| `static/tools/post-tool.html` | 投稿ツール。投稿前に post-rules.js で検証し、既存記事との URL 重複を GitHub API と公開ページで確認する |
| `scripts/validate/validate-content.mjs` | CI 用。全記事を検証し、Hugo が実際に作る URL（`hugo list all`）で衝突を調べる |
| `scripts/validate/known-issues.json` | **既存の不備リスト**。ここに載っている不備は失敗にしない（新しい不備だけを失敗にする） |
| `scripts/validate/test/run-tests.mjs` | ルールのテスト（BOM・CRLF・インライン配列・日付・衝突など）と既存記事の回帰テスト |
| `scripts/validate/test/event-dates-hugo.mjs` | 表示側の日付解釈（`layouts/partials/event-dates.html` ほか、工程1a PR 3）のテスト。最小の Hugo サイトで約80通りを確かめる。**Hugo が必要**で、CI ではまだ実行していない |
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
| `shopStatus` | `open`／`open_planned`／`close`／`close_planned`／`temp_close`／`reopen`／`renewal`／`move`／`feature` | `SHOPSTATUS_INVALID` |
| `shopDate` | `"YYYY-MM-DD"` または `"YYYY-MM"`（年月だけ。月初・月末に読み替えない） | `SHOPDATE_FORMAT`・`_INVALID`（13月・2月30日等）・`_EMPTY` |
| `shopUnconfirmed` | 真偽値 `true`／`false`（引用符なし） | `SHOPUNCONFIRMED_NOT_BOOLEAN`（`"true"` は文字列なのでエラー） |
| `calendar` | 真偽値 `true`／`false`（引用符なし） | `CALENDAR_NOT_BOOLEAN` |

警告は `NOTABLEDATES_UNSORTED`（日付順でない）・`NOTABLEDATES_DUPLICATE`（重複）だけ。更新時は開催日と同じく、追加・変更した項目だけにエラーを適用し、値を変えていない項目のエラーは警告に下げる。既存記事で新項目を持つのは `notableDate` の1本だけで、該当する不備は無い（2026-10-05 時点）。

## CI の動き（公開は止めない）

- `validate` ジョブは `build`／`deploy` と**独立**している。不備があっても公開は従来どおり進む
- 新しい不備があると `validate` ジョブだけが失敗し、GitHub から失敗通知が届く。Actions の実行結果ページ（Summary）に一覧が出る
- 予約投稿は失敗にせず、Summary に「予約投稿」として一覧表示する
- frontmatter が壊れて Hugo 自体が失敗した場合（これは以前から公開が止まる）も、`validate` は frontmatter から推定した範囲で検査を続け、壊れているファイルを示す

### 失敗したときの対応

1. Actions の該当実行 → `validate` ジョブの Summary を開く
2. 「新しい不備」「新しい URL 衝突」に出ているファイルを直す
   - URL 衝突: **後から追加した記事**（一覧で「（新たに追加）」と表示）の `slug` を変える。続報なら `<元の slug>-<YYYYMMDD>` が目安
   - ほかの不備: メッセージどおりに frontmatter を直す
3. 直したコミットを push すると再検証される。公開済みの内容に問題があった場合はその後のビルドで反映される

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
```

## 将来の選択肢（運営判断）

| 方式 | 内容 | 副作用 |
|---|---|---|
| 現在：通知のみ | 不備があっても公開し、validate だけ失敗 | 不正な記事も一旦公開される（投稿ツールでは事前にブロック） |
| 公開前ブロック | `build` に `needs: validate` を足す | 不備が1件でもあるとその後の全記事が公開されない |
| PR 経由の投稿 | 投稿ツールが main ではなくブランチ＋PR を作る | 運用手順が変わる・マージ作業が必要 |
