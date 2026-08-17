# Bing / Naver への検索エンジン登録手順（海外アクセス施策④）

作成: 2026-08-17。アカウント作成・ログインは運営者本人の作業。認証タグの設置とサイトマップ送信の確認は Claude Code に依頼できる。

サイトマップURL（全5言語を含む sitemapindex）: `https://urayasu-portal.com/sitemap.xml`

## 1. Bing Webmaster Tools（英語圏・所要約10分）

Bing は **Google Search Console からのインポート**が使えるため、サイト認証タグは不要。

1. https://www.bing.com/webmasters にアクセスし、Microsoft アカウントでサインイン
2. 「GSC からインポート」（Import from Google Search Console）を選択
3. Google アカウント（GSC で urayasu-portal.com を管理しているもの）で認可
4. urayasu-portal.com を選択してインポート → サイトマップも自動で引き継がれる
5. 念のため「Sitemaps」メニューで `https://urayasu-portal.com/sitemap.xml` が登録されているか確認。無ければ手動で追加

補足: ChatGPT 等の Bing 系検索にも反映されるため、英語圏の AI 経由流入にも効く。

## 2. Naver Search Advisor（韓国・所要約20分）

Naver アカウントが必要（外国人でも作成可能だが SMS 認証あり）。

1. https://searchadvisor.naver.com にアクセスし、Naver アカウントでログイン
2. 「웹마스터 도구（ウェブマスターツール）」→ サイト登録で `https://urayasu-portal.com` を入力
3. 所有確認方法で「HTML 태그（HTML タグ）」を選ぶと、次の形式のメタタグが表示される:
   `<meta name="naver-site-verification" content="XXXXXXXX" />`
4. **この content の値を Claude Code に伝えれば、`layouts/partials/extend_head.html` に追記してデプロイまで対応する**
5. デプロイ後、Naver 側で「확인（確認）」を押して認証を完了
6. 「요청（リクエスト）」→「사이트맵 제출（サイトマップ送信）」で `https://urayasu-portal.com/sitemap.xml` を送信

補足: ko 版71本が対象。Naver は反映に数週間かかることがある。

## 3. 効果確認

- Bing: Webmaster Tools の「検索パフォーマンス」（データ反映まで数日）
- Naver: Search Advisor の「검색 노출 현황」
- 次回 GSC 再計測（2026年9月下旬〜10月）の際に、Bing/Naver の数値も併せて記録する
