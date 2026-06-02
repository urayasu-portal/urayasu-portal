# 浦安ぽーたる プロンプト管理リポジトリ

浦安ぽーたる（urayasu1889.net）の運用プロンプトを管理するリポジトリです。

## プロンプト一覧

| ファイル | 役割 | 現行バージョン | 最終更新 |
|---|---|---|---|
| [prompts/research.md](prompts/research.md) | リサーチ | v20260430 | 2026-04-30 |
| [prompts/articleize.md](prompts/articleize.md) | 記事化 | v20260601b | 2026-06-01 |
| [prompts/post.md](prompts/post.md) | 投稿 | v20260507 | 2026-05-07 |

## Raw URL（Claude web_fetch 用）

```
https://raw.githubusercontent.com/urayasu-portal/urayasu-portal/main/prompts/research.md
https://raw.githubusercontent.com/urayasu-portal/urayasu-portal/main/prompts/articleize.md
https://raw.githubusercontent.com/urayasu-portal/urayasu-portal/main/prompts/post.md
```

## Claudeへの指示フレーズ（コピー用）

### リサーチ
```
今日（YYYY年MM月DD日）のリサーチをしてください。
リサーチプロンプト：https://raw.githubusercontent.com/urayasu-portal/urayasu-portal/main/prompts/research.md
```

### 記事化
```
上記リサーチ結果のNo.{N}を記事化してください。
記事化プロンプト：https://raw.githubusercontent.com/urayasu-portal/urayasu-portal/main/prompts/articleize.md
```

### 投稿
```
以下の記事を投稿してください。
投稿プロンプト：https://raw.githubusercontent.com/urayasu-portal/urayasu-portal/main/prompts/post.md
```

## プロンプト更新手順

1. 該当ファイルをGitHub上で直接編集（または git push）
2. ファイル冒頭の `<!-- version: ... | updated: ... -->` を書き換える
3. このREADMEの「プロンプト一覧」テーブルを更新する
4. コミットメッセージ例：`update articleize to v20260610`

> ファイル名は変更しないこと。URLが変わるとClaudeへの指示文も書き換えが必要になります。

## ファイル名ルール

- ファイル名はバージョンを含めない（`research.md` / `articleize.md` / `post.md` で固定）
- バージョン情報はファイル冒頭コメントとREADMEテーブルで管理する
- 過去バージョンはGitのコミット履歴で参照できる
