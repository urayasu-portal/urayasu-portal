# 個別ホテルページ 横展開テンプレート：荷物預けセクション＋FAQPage

Phase 3（brighton-tokyo-bay.en.md）で確立した「荷物預け（チェックイン前）」独立セクションと
FAQPage 構造化データを、他の個別ホテル `.en.md` に展開するための雛形と手順。

対応するSearch Console実測ニーズ：個別ホテル名＋「luggage storage before check in」
「with shuttle」等の実用情報クエリ。

---

## 1. frontmatter に `faq:` を追加（→ FAQPage JSON-LD が自動出力）

`layouts/partials/faq-jsonld.html` が `faq:` を拾い、extend_head から全ページで JSON-LD 化する。
質問は「そのホテルで実際に検索される実用クエリ」を選ぶ。回答は**本文・CSVにある事実のみ**。

```yaml
faq:
  - q: "Can I store my luggage at <HOTEL> before check-in?"
    a: "<当日フロント預かりの可否＋駅接続やロッカー事情。確認済み事実のみ>"
  - q: "Does <HOTEL> have a free shuttle bus to Tokyo Disney Resort?"
    a: "<シャトル種別・本数・所要時間。data/hotels.yaml の shuttle_type と本文Accessに一致させる>"
  - q: "Does <HOTEL> have a large public bath or coin laundry?"
    a: "<大浴場/コインランドリーの有無。May Not Suit と矛盾させない>"
```

## 1.5. 共有解説ページへ必ずリンクする

舞浜の荷物・配送の仕組み（駅→ホテル：ディズニー/オフィシャルは無料WC・パートナー/独立は有料
Bon Voyage 800円／ホテル→駅：有料Station Delivery／パーク→ホテルは無し）は
**`/en/travel-guide/hotels/luggage/`（共有解説ページ）に集約済み**。各ホテルは自館の要点だけ書き、
仕組みの詳細はこのページへリンクする（重複を避け、内部リンクを増やす）。

## 2. 本文の荷物記述（Facilities内「**Luggage**」小項目 または H2）

- **情報が濃い軒**（独自ロッカー・時刻/料金が揃う）＝独立H2でもよい。**薄い軒**＝Facilities内の
  「**Luggage**」小項目1つで十分（水増ししない）。
- **必ず「方向」を書く**：①チェックイン前預かり(場所/時刻) ②チェックアウト後 ③配送=駅→ホテル/
  ホテル→駅のどちらか・無料/有料と金額。**「park-to-hotel」と書かない**（舞浜駅ハブ経由が正しい）。
- 末尾に必ず `[how Maihama luggage delivery works](/en/travel-guide/hotels/luggage/)` へのリンク。
- 事実源＝CSV`荷物預かり`列（2026-07公式照合済みの軒は詳細あり）＋各.md本文。未公表の料金/制限は断定禁止。

```markdown
## Luggage Storage (Before Check-in) & Baggage Delivery

<1文：チェックイン前に荷物を預けられるかという定番の質問への直球回答>

- **Before check-in (same-day storage):** <当日フロント預かりの可否。確認済みのみ>
  <!-- TODO: 要確認 — 預かり開始時刻・個数/サイズ制限・料金（無料か） -->
- **Easy arrival with heavy suitcases:** <駅接続・屋根付き通路など、荷物運搬のしやすさ>
- **Park-to-hotel baggage delivery (paid):** <パーク→ホテル配送サービスの有無・料金（あれば）>
- **Coin lockers:** <!-- TODO: 要確認 — 館内ロッカーの有無、無ければ最寄駅ロッカー -->

Check-in is <IN> and check-out is <OUT>; same-day storage around these times is standard,
but confirm the details with the hotel when you book.
```

## 3. 事実ソースと厳守ルール

- **事実は CSV（`荷物預かり`列＝30列目・`チェックイン/アウト`列）と各ホテル本文の既出情報のみ**。
  不明点は必ず `<!-- TODO: 要確認 — ... -->` を残す（本文に「要確認」の文字列は出さない＝CLAUDE.md）。
- **`lastmod` を作業当日に更新**（個別ホテルページは `date` を持つので未来日付トラップは起きない。
  逆に `date` の無いセクション `_index.*.md` に lastmod だけ足すと未来扱いで非生成になる点に注意）。
- FAQの回答は本文・`data/hotels.yaml`（shuttle_type 等）と矛盾させない。ホテル名の各言語表記は
  `data/hotels.yaml` の name_* を使う（他言語版に展開する場合）。
- アンカーリンクは Hugo(goldmark) の自動見出しID（記号除去・小文字・空白→ハイフン）に合わせる。

## 4. 展開候補（GSC表示のある個別ホテル優先）

hilton-tokyo-bay / oriental-tokyo-bay / emion-tokyo-bay / mitsui-garden-prana /
sheraton-grande-tokyo-bay / hotel-okura-tokyo-bay ほか。まず英語版(.en.md)から着手。
