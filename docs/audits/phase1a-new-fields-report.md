# 浦安ぽーたる 工程1a／PR 1a-2 新しい日付・店舗情報の項目の受け入れ 報告書

- 実施日: 2026-10-05
- 実施者: Claude Code（Claude Opus 5.5）
- 関連: [工程1a-1 設計書](phase1a-design.md)（第3〜12章は提案）／[PR 1a-1 報告書](phase1a-date-validation-report.md)／[検証の運用手順](../../scripts/validate/README.md)

---

## 1. 作業概要と基準コミット

| 項目 | 内容 |
|---|---|
| 基準コミット | `932ee14d`（作業開始時の最新 `origin/main`。PR #12 反映後） |
| 作業ブランチ | `claude/phase1a-new-fields`（worktree `C:\Users\kadoh\worktrees\urayasu-phase1a-nf`、OneDrive の同期対象外） |
| 実装コミット | `34c7d292` |
| 目的 | 記事化プロンプトの改訂に先立ち、新しい frontmatter 項目を投稿ツールと CI で受け入れ、形式を検証できるようにする |
| 範囲 | 項目の受け入れと検証のみ。既存記事の意味・表示・カレンダー・構造化データ・年表は変更しない |
| push・PR | **未実施**（運営者の承認待ち） |

今回採用した仕様は運営者の指示書で確定したもの（第3章）。設計書の第3〜12章のうち、カレンダーの掲載基準・構造化データ・年表の分類・カードの表示などは**後続工程で決める提案**のままで、本 PR では実装していない。

## 2. 変更したファイル

| ファイル | 変更 |
|---|---|
| `static/tools/post-rules.js` | 新項目の検証 `checkNewFields`（新規）。`notableDate(s)` 用に日付解析の「時刻を許さない」設定を追加。更新時の互換処理（PR 1a-1）を新項目にも適用 |
| `scripts/validate/test/run-tests.mjs` | テスト 20 件を追加（計 95 件） |
| `scripts/validate/README.md` | 新項目の規則表 |
| `CLAUDE.md` | 新項目の定義、現行プロンプト v20260907 の運用を変えないこと、表示に未反映であること |
| `docs/audits/phase1a-new-fields-report.md` | 本書 |

`static/tools/post-tool.html`・`tools/post-tool.html` は**変更していない**（`post-rules.js` を読み込むだけで新規則が適用される。新項目を削除・書き換えしないことは第6章で確認）。テンプレート・記事・CI ワークフロー・`known-issues.json` も変更していない。

## 3. 新項目の定義と検証規則

| 項目 | 許可する値 | 用途（予定） | 現在の表示への影響 |
|---|---|---|---|
| `eventKind` | `event`／`match`／`fair` | 開催日の種別（催し・講座・祭り・展示・体験会／試合・大会／期間限定フェア・季節限定メニュー・期間限定販売） | なし |
| `notableDate` | `"YYYY-MM-DD"`（単日） | イベントではない注目の日（制度の開始日・告知の対象日・申込期限・休館日など） | サイドバーのカレンダーが点灯（従来から） |
| `notableDates` | `"YYYY-MM-DD"` のリスト | 同上（複数） | 同上 |
| `shopStatus` | `open`／`open_planned`／`close`／`close_planned`／`temp_close`／`reopen`／`renewal`／`move`／`feature` | 店舗の状態 | なし |
| `shopDate` | `"YYYY-MM-DD"` または `"YYYY-MM"` | 店舗の状態が発生する日（年月だけも正式に認める。月初・月末の日付に読み替えない） | なし |
| `shopUnconfirmed` | `true`／`false`（YAML の真偽値） | 未確定情報（求人で判明・「〜か」等） | なし |
| `calendar` | `true`／`false`（YAML の真偽値） | イベントカレンダー掲載の記事単位の上書き | なし（掲載条件は変更していない） |

- すべて**任意項目**。無いことは警告にしない
- カテゴリとの組み合わせ（例: 開店・閉店記事の `eventDate`、イベント記事の `shopStatus`）は検証しない
- `shopStatus` を予定日経過で自動変更する処理は無い（検証のみ）
- 情報の確度（`shopUnconfirmed`）と状態（`shopStatus`）の組み合わせは検証しない

### 3.1 既存のテンプレートでの扱い（Hugo 0.167.0 で確認）

新項目を持つテスト記事を1本ずつ追加してビルドし、生成結果を確認した（一時ディレクトリで実施）。

| 項目・値 | ビルド | 表示への影響 |
|---|---|---|
| `eventKind`・`shopStatus`・`shopDate`・`shopUnconfirmed`・`calendar`（正常値） | 成功 | なし（`/events/`・Event 構造化データ・サイドバーとも変化なし。`calendar: false` でもカレンダーに載ったまま） |
| `notableDate`・`notableDates`（正常値、引用符なしも可） | 成功 | サイドバーのカレンダーがその日を点灯（`partials/sidebar-calendar.html` の既存処理） |
| `notableDate` の不正値（`2026-02-30`）・`notableDates` の不正な要素（`10月1日`） | 成功 | サイドバーの点灯データにそのまま入るが、どの日にも一致しないため点灯しない |
| **`notableDates` が文字列（リストでない）** | **失敗** | `sidebar-calendar.html` の `range` が文字列を反復できず、サイト全体のビルドが止まる |
| `eventKind`・`shopStatus`・`shopDate`・`calendar` の不正値 | 成功 | なし |

既存の `notableDate(s)` の動作（サイドバーの点灯）は変更していない。`/daily/` は `notableDate(s)` を読まないため、サイドバーで点灯した日をクリックしても、その記事は日付別一覧に出ない（従来どおり。第9章）。

## 4. エラー・警告の区分

**エラー**（投稿をブロック／CI で新しい不備として報告）

| コード | 内容 |
|---|---|
| `EVENTKIND_INVALID` | `eventKind` が3種類以外（空・大文字・日本語・真偽値を含む） |
| `SHOPSTATUS_INVALID` | `shopStatus` が9種類以外 |
| `NOTABLEDATE_FORMAT`・`_INVALID`・`_EMPTY`・`_SPACED`・`_SEPARATOR`・`_RANGE_NOT_ALLOWED` | `notableDate` の形式不正・実在しない日付・空・空白・区切り・期間・時刻付き・リスト |
| `NOTABLEDATES_NOT_LIST`・`_EMPTY`・要素ごとの `_FORMAT`・`_INVALID` 等 | `notableDates` がリストでない（ビルドが止まる）・空・不正な要素（何番目かを表示） |
| `SHOPDATE_FORMAT`・`_INVALID`・`_EMPTY` | `shopDate` の形式不正（`2026/10/20`・期間・「10月下旬」等）・存在しない年月（13月・00月）・日付（2月30日・平年の2月29日）・空 |
| `SHOPUNCONFIRMED_NOT_BOOLEAN` | 真偽値でない（引用符付きの `"true"`・`"false"`、`yes`、`True` を含む） |
| `CALENDAR_NOT_BOOLEAN` | 同上 |

**警告**: `NOTABLEDATES_UNSORTED`（日付順でない）・`NOTABLEDATES_DUPLICATE`（重複）だけ。

YAML の真偽値と引用符付きの文字列は区別している（投稿ツールの frontmatter 解析で、引用符なしの `true`／`false` だけが真偽値になる）。

## 5. 既存記事との互換性

| 要件 | 結果 |
|---|---|
| 新項目が無い既存記事を受け付ける | ✅ 既存記事で新項目を持つのは `notableDate` の1本だけ。全記事を新規と同じ基準で検証して、新項目の規則に当たるもの 0 |
| 現行プロンプト v20260907 の新規記事を受け付ける | ✅ 新項目なし・開店記事に `eventDate` の記事で、新しいエラー・警告なし |
| 本文・`lastmod` だけの更新を止めない | ✅ 新項目を持つ記事の全文置換も通過。値を変えていない新項目のエラーは警告に下げる（PR 1a-1 と同じ方式を再利用） |
| `eventDate`・`eventDates` の既存規則 | ✅ 変更なし（PR 1a-1 のテストはすべて通過） |
| `eventOngoing`・`hideEventBox` | ✅ 変更なし |
| 予約投稿の警告・確認 | ✅ 変更なし（新項目付きでも同じ） |

更新時に既存ファイルを読めない場合は、新項目も新規と同じ基準で検証し、その旨を警告する（PR 1a-1 の `EVENT_PREV_UNAVAILABLE` を新項目にも拡張。文言を「日付・店舗情報の項目」に変更）。

## 6. 投稿ツール・CI のテスト結果

### 6.1 投稿ルールのテスト

**95 passed, 0 failed**（既存 75 件＋追加 20 件）。CI と同じ `--unit-only` は 91 passed。

追加したテスト: 新項目が無い記事／`eventKind` の正常値3種類と不正値／`shopStatus` の正常値9種類と不正値／`notableDate` の正常・不正（実在しない日付・日本語・期間・時刻・空・リスト）／`notableDates` の正常な配列・不正な要素・文字列・空・未整列・重複／`shopDate` の日付・年月・存在しない年月日・不正な形式・空／`shopUnconfirmed`・`calendar` の真偽値と文字列（`"true"`・`yes`・`True`・`1`）／新項目をすべて付けた新規投稿（既存の `eventDate`・`eventOngoing` との併用）／開店・閉店記事の `eventDate` に新しい警告が出ないこと／新項目を保持した既存記事の全文置換／既存の不正値を変えない更新（警告）と不正に変えた更新（エラー）／新項目付きの予約投稿／既存記事の実データの回帰。

### 6.2 CI

- 全記事の検証: 新しい不備 0・URL 衝突 0・重複出力パス 0。既知の不備 360 件は変わらず（`known-issues.json` は変更なし）
- 検出の確認: 不正な新項目を持つ記事を1本加えると、ファイル名・項目を示して6件（`EVENTKIND_INVALID`・`NOTABLEDATES_NOT_LIST`・`SHOPSTATUS_INVALID`・`SHOPDATE_INVALID`・`SHOPUNCONFIRMED_NOT_BOOLEAN`・`CALENDAR_NOT_BOOLEAN`）を新しい不備として報告し、終了コード 1（公開フローとは独立のまま）

### 6.3 投稿ツール（ブラウザでの模擬テスト）

本ブランチを Hugo 0.167.0 でローカル配信し、アプリ内ブラウザで `/tools/post-tool.html` の投稿処理（`submitArticle`）を実行した。GitHub API はページ内で模擬し（ダミーのトークン。実際の通信・書き込みは0件。保存済みトークンの状態は元に戻した）、書き込み要求（PUT）の本文を復号して、入力と比較した。

| ケース | 結果 | 書き込み | 書き込み内容＝入力 |
|---|---|---|---|
| 新項目なし（v20260907 形式・開店記事に `eventDate`） | 投稿完了 | 1 | 一致 |
| 新項目をすべて付けた新規投稿 | 投稿完了 | 1 | **一致**（新項目は削除・書き換えされない） |
| 不正な新項目（`eventKind`・`shopStatus`・`shopDate`） | **ブロック** | 0 | — |
| 不正な真偽値（`"true"`・`"false"`） | **ブロック**（「引用符で囲むと文字列になります」） | 0 | — |
| `notableDates` が文字列 | **ブロック** | 0 | — |
| 新項目を保持した既存記事の全文置換 | 上書き確認 → 更新完了 | 1 | 一致 |
| 新項目を不正に変えた更新 | **ブロック** | 0 | — |
| 予約投稿（確認で中止） | 予約投稿の警告 → 中止 | 0 | — |

- カバー画像の設定を適用する処理（`applyCoverBlock`）を通しても、新項目はすべて残ることを確認した
- 正常なケースで出た確認1回は、ローカル配信時に必ず出る既存の注意（「公開中のページとの重複チェックは本番の投稿ツールから開いたときだけ行います」）で、新規則とは無関係
- 検証のため、本体作業ツリーの `.claude/launch.json`（Git 管理外）に一時的に配信設定を追加し、確認後に元のファイルへ戻した（SHA-1 一致）

## 7. Hugo・Pagefind・生成サイトの比較結果

本番と同条件（`git -c core.autocrlf=false archive` で展開、Hugo 0.167.0、Pagefind 1.5.2）でビルドし、`scripts/baseline/` で改修前（`932ee14d`）と比較した。

| 項目 | 結果 |
|---|---|
| Hugo 0.167.0 | 成功（WARN は従来の1件のみ） |
| Pagefind 1.5.2 | 成功（2,924 ページ） |
| 生成物の全ファイル比較 | 変わったのは `/tools/post-rules.js` だけ |
| 記事の URL・公開日・frontmatter（`content-inventory`） | 差分なし |
| 全ページの title・canonical・hreflang・構造化データの種類（`pages`） | 差分なし |
| 構造化データの内容（`jsonld`、Event を含む全 2,974 ブロック） | 差分なし |
| 記事カード（`cards`、23,181 枚） | 差分なし |
| `/events/`・`/daily/`・`/open-close/` | HTML が全ファイル比較で一致 |
| サイトマップ・転送ページ・アフィリエイト URL | 差分なし |
| 内部リンク | リンク切れ 0 |

## 8. 現行の記事化プロンプト v20260907 との整合性

- v20260907 は新項目を出力しない。本 PR の後も、v20260907 で作成した記事は従来どおり受け付ける（第5章）
- v20260907 の `eventDate`（注目の日。開店日・閉店日・試合日・告知日を含む）、`eventDates`（複数日程）、`eventOngoing`（終了日未定）、`hideEventBox`、全文置換の更新方式はすべて維持
- CLAUDE.md には「現行運用は v20260907 のまま」「新項目は受け入れと検証の段階で、表示には未反映」「プロンプトの切り替えは表示側の対応と連動」と明記し、現行の指示と新項目の定義が矛盾しないようにした

## 9. プロンプト改訂と表示機能の移行順序

### 9.1 現時点で表示に使われない新項目

`eventKind`・`shopStatus`・`shopDate`・`shopUnconfirmed`・`calendar` の5項目は、**どのテンプレートも読まない**。記事に書いても表示は何も変わらない。

`notableDate`・`notableDates` は**サイドバーのカレンダー**（`layouts/partials/sidebar-calendar.html`）だけが読み、その日を点灯させる。`/daily/`・`/events/`・記事カード・終了通知・Event 構造化データは読まない。

### 9.2 現在の機能ごとの参照項目

| 機能 | 読む項目 |
|---|---|
| サイドバーのカレンダー（点灯） | `eventDate`（期間は開始日だけ）、`eventDates`、`notableDate(s)`、`openDate`、`closeDate` |
| `/daily/`（日付別一覧） | `eventDate`、`eventDates`（開始日一致） |
| `/events/`（イベントカレンダー） | `eventDate`（＋`eventEndDate`・`eventLocation`） |
| 記事カードの開催日ラベル | `eventDate`（1件目のカテゴリがイベントの場合） |
| 終了通知 | `eventDate`・`eventOngoing` |
| Event 構造化データ | `eventDate` ほか |
| 開店・閉店年表 | `data/openclose.yaml`・タイトル |

### 9.3 記事の種類ごとの切り替え時期（推奨）

現行の `eventDate` は、イベント以外の注目の日にも使われ、上表のとおり多くの機能がそれを読んでいる。表示側が新項目を読む前に `eventDate` を外すと、記事がカレンダー・サイドバー・終了通知から消える。逆に、旧項目と新項目を無条件に併記すると、意味の二重管理になる。そこで、**記事の種類ごとに、表示側の対応が済んだものから順に切り替える**。

| 段階 | 記事の種類 | プロンプトの変更 | 前提となる後続 PR | 理由 |
|---|---|---|---|---|
| A | イベント・スポーツ・期間限定フェア | `eventDate(s)` はそのまま、`eventKind` を追加 | PR 1a-2（本 PR）の反映後でも技術的には可能。プロンプト改訂の回数を減らすなら PR 3 と同時 | `eventKind` は追加するだけで、どの機能の動作も変えない。`eventDate` の意味はこれらの記事では変わらない |
| B | お知らせ・ニュース等の「行けない日」（制度開始・告知の対象日・締切・休館） | `eventDate` → `notableDate(s)` に置き換え | **PR 3**（日付解釈の共通化。`/daily/`・終了通知が `notableDate(s)` を読む）と **PR 4**（カレンダー・構造化データの掲載基準） | PR 3 前に置き換えると、`/daily/` と終了通知（予告記事への「〜より前に掲載した告知」）から外れる。PR 4 前でも、カレンダーから外れるのは設計どおりだが、基準の確定と同時が望ましい |
| C | 開店・閉店・休業・再開・移転 | `eventDate` → `shopStatus`＋`shopDate`（＋`shopUnconfirmed`）に置き換え | **PR 3**（サイドバー・`/daily/` が `shopDate` を読む）と **PR 5**（年表が `shopStatus` を読む） | PR 3 前に置き換えると、サイドバーの点灯・`/daily/` から店舗の日付が消える。PR 5 前は年表が新項目を使わない |
| D | 個別にカレンダー掲載を上書きしたい記事 | `calendar: true/false` を付ける | **PR 4** | PR 4 まで `calendar` は効かない |

- 段階 B・C は、該当する PR の反映と**同じ日**にプロンプトを切り替える（間に空白期間を作らない）
- 切り替え前の既存記事は書き換えない（後続 PR のテンプレートが、新項目の無い記事を従来の `eventDate` とカテゴリで扱う＝設計書 3.3 の後方互換）

### 9.4 移行期間中の影響（新項目を表示側の対応より先に使った場合）

| 機能 | `eventKind` を付けた | `eventDate` を外して `notableDate` にした | `eventDate` を外して `shopStatus`・`shopDate` にした |
|---|---|---|---|
| 記事カード | 変化なし | 変化なし（お知らせには元々ラベルなし） | 変化なし（開店・閉店には元々ラベルなし） |
| サイドバーのカレンダー | 変化なし | 点灯を維持（`notableDate` は既に読まれる） | **点灯が消える**（`shopDate` を読まない） |
| `/daily/` | 変化なし | **その日の一覧から消える** | **消える** |
| `/events/` | 変化なし | 掲載から外れる（設計上は望ましいが、基準確定前） | 掲載から外れる |
| 終了通知 | 変化なし | **予告記事の「〜より前に掲載した告知」が出なくなる** | 同左 |
| Event 構造化データ | 変化なし | 出力されなくなる | 出力されなくなる |
| 開店・閉店年表 | — | — | 変化なし（`shopStatus` を読まない） |

このため、段階 A 以外の切り替えは、対応する後続 PR の反映までは行わない。

## 10. 未解決事項と後続 PR への引き継ぎ

- **PR 3（日付解釈の共通化と表示）**: `eventDate`・`eventDates`・`notableDate(s)`・`shopDate` を1つの partial で解釈し、サイドバー・`/daily/`・終了通知・記事カードを揃える。`/daily/` が `notableDate(s)` を読まない既存の不整合もここで解消する。`shopDate` の年月だけの値（`YYYY-MM`）を、日付別の表示でどう扱うか（月の見出しにだけ出す等）を決める必要がある
- **PR 4（カレンダーと Event 構造化データ）**: `eventKind` と `calendar` を掲載判定に使う。設計書第4・6章の運営判断（フェアの扱い、会場名がない記事の Event 出力など）が前提
- **PR 5（開店・閉店年表）**: `shopStatus`・`shopDate`・`shopUnconfirmed` を年表に反映。`data/openclose.yaml` の type 拡張と、年間件数の数え方
- **新規記事への警告**: プロンプトが新項目を出力するようになった後、必要に応じて「開店・閉店記事に `shopStatus` が無い」等の警告を新規記事だけに導入する（本 PR では導入していない）
- **ルール18**（公開日より大きく過去の `eventDate`）は引き続き未実装
- **main への直接コミット**: CI の検証は通知のみのため、`notableDates` の文字列など Hugo を止める値が main に直接入ると公開が止まる（PR 1a-1 報告書 第8章と同じ）。`build` に `needs: validate` を付けるかは運営判断
- 本 PR の push・PR 作成・本番反映は運営者の承認待ち
