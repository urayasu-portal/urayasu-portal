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
| `.github/workflows/hugo.yml` の `validate` ジョブ | push・schedule・手動実行のたびに上記を実行 |
| `.github/workflows/pr-check.yml` | Pull Request 時にビルド（本番と同じオプション）・Pagefind・検証を実行。**デプロイはしない**。Hugo／Pagefind の版は hugo.yml と揃える |

## ルール（新規記事）

| 区分 | 内容 |
|---|---|
| エラー（投稿ブロック／CI 失敗） | frontmatter の `---` 区切りが無い・書式の誤り（閉じていないクォート、項目の重複、タブ字下げ等）／`title` 無し／`date` 無し・形式不正・存在しない日時／`slug` 無し（`url:` 指定があれば可）・形式不正（半角英小文字・数字・ハイフン）／`categories` 無し（ja のみ）・許可外の値（ブロック形式・インライン形式の両方）／`draft: false` 無し／`eventDate` があるのに `hideEventBox: true` 無し／**既存記事と URL（slug・url・aliases）が重複** |
| 警告（投稿は続行可） | 未来の `date`（予約投稿。30日より先は誤入力の可能性として強めに警告）／`date` にタイムゾーン無し（UTC 扱い＝日本時間で9時間ずれる）／ファイル名の日付と `date`（日本時間）の不一致／`eventDate` の形式不正／lastmod の付け忘れ・付けすぎ／本文の注意点（短い・iframe 等） |
| 既存記事の更新 | `slug` が無い記事（ファイル名から URL が決まる176本）はそのまま更新できる。`slug` を変えると URL が変わる旨を警告する |

予約投稿（未来の `date`）は**禁止していない**。投稿ツールは公開予定時刻（日本時間）を表示し、確認を求める。

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

## 将来の選択肢（運営判断）

| 方式 | 内容 | 副作用 |
|---|---|---|
| 現在：通知のみ | 不備があっても公開し、validate だけ失敗 | 不正な記事も一旦公開される（投稿ツールでは事前にブロック） |
| 公開前ブロック | `build` に `needs: validate` を足す | 不備が1件でもあるとその後の全記事が公開されない |
| PR 経由の投稿 | 投稿ツールが main ではなくブランチ＋PR を作る | 運用手順が変わる・マージ作業が必要 |
