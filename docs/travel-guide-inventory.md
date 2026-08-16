# 旅行ガイド 棚卸し表（Phase 1）

作成日: 2026-08-16
データソース: GSC過去3か月（2026-05-16〜08-16頃・ウェブ検索）＋ リポジトリ実測（被リンク＝日本語記事本文からのリンク数。ナビ・ハブカードは含まない）
対象: 日本語記事76本（直下14＋ホテルテーマ17＋個別ホテル45）× 5言語

## 読み方

- **jaC/jaI** = 日本語版のクリック/表示回数、**mlC/mlI** = 多言語4版（en/ko/zh/zh-tw）合算
- **判定**（暫定・Phase 2で確定）:
  - `維持` 現状の役割で問題なし
  - `導線` 実績があるのに本文導線が不足 → リンク追加が先
  - `改題` 表示は取れているのにCTRが低い → タイトル/description改善が先
  - `統合?` 統合・吸収の検討対象
  - `観察` 公開直後などで判断保留

## 全体サマリ

| 区分 | クリック | 表示回数 |
|---|---|---|
| サイト全体 | 4,371 | 124,401 |
| posts（ニュース） | 4,033（92%） | 104,263 |
| travel-guide 全体 | 171（4%） | 13,153 |
| うち多言語版 | 133（TGの78%） | 11,192 |

- 旅行ガイドの流入はまだ小さく、**URL統合・再構成で失うものが少ない今が整理の好機**
- 言語別効率: **zh-tw 70クリック（CTR 4.51%）＞ en 45（表示7,611・CTR 0.59%）＞ ja 38 ＞ ko 12 ＞ zh 6**
- 個別ホテル45軒合計: ja 17クリック/501表示、多言語 63クリック/3,869表示

---

## 1. 直下記事（14本）

時間軸: 旅マエ準備 / 旅ナカ移動 / 旅ナカ滞在

| 記事 | 時間軸 | 被リンク | jaC | jaI | mlC | mlI | lastmod | 判定 |
|---|---|---|---|---|---|---|---|---|
| access-guide | 旅ナカ移動 | 8 | 2 | 160 | 0 | **769** | 08-16 | 維持（アクセス系の正） |
| urayasu-maihama-shinurayasu-tourism | 旅ナカ滞在 | **0** | 1 | 13 | 8 | **854** | 08-01 | **導線**（TG直下で表示2位なのに本文被リンク0） |
| disney-tickets | 旅マエ準備 | 5 | 0 | 50 | 2 | 593 | 07-13 | 維持 |
| gourmet-guide | 旅ナカ滞在 | **0** | 2 | 40 | 6 | 387 | 06-19 | **導線** |
| tokyo-sightseeing-access | 旅ナカ移動 | 2 | 2 | 97 | 3 | 378 | — | 導線弱め |
| taxi-guide | 旅ナカ移動 | 4 | 0 | 74 | 4 | 376 | 07-12 | 維持 |
| kasai-rinkai-park | 旅ナカ滞在 | 6 | 0 | 103 | 0 | 136 | — | 維持 |
| maihama-eurasia-spa | 旅ナカ滞在 | 6 | 3 | **368** | 6 | 123 | — | 維持（**ja直下で表示1位**） |
| urayasu-traffic-park | 旅ナカ滞在 | 6 | 0 | 11 | 10 | 97 | — | 維持 |
| kids-emergency | 旅マエ準備 | 3 | 2 | 37 | 2 | 68 | 07-06 | 維持 |
| teamlab-planets | 旅ナカ滞在 | 6 | 1 | 74 | 3 | 58 | — | 維持 |
| urayasu-map | 旅ナカ滞在 | 2 | 0 | 21 | 0 | 23 | 07-09 | 維持 |
| pre-trip-checklist | 旅マエ準備 | 0 | 0 | 0 | 0 | 4 | — | 維持（**インバウンド専用の意図設計**・ja非表示は運営者確認済み 2026-08-16） |
| _index（/travel-guide/） | ハブ | 0 | 0 | 20 | 0 | 76 | — | 維持 |

## 2. ホテルテーマ記事（17本）

時間軸: 大半が旅マエ比較。荷物3部作のみ準備/移動。

| 記事 | 時間軸 | 被リンク | jaC | jaI | mlC | mlI | lastmod | 判定 |
|---|---|---|---|---|---|---|---|---|
| shuttle | 旅マエ比較+旅ナカ移動 | 7 | 0 | 12 | **10** | **1,006** | 08-08 | **改題**（TG最強ページ。en「urayasu hotels with shuttle」10.8位で表示128・クリック0） |
| hotels/_index | ハブ | 15 | 0 | 0 | 0 | 748 | — | 維持 |
| happy-entry | 旅マエ比較 | 7 | 0 | 20 | 5 | 431 | 08-08 | 維持 |
| budget | 旅マエ比較 | 5 | 0 | 88 | 0 | 313 | 08-08 | 改題候補（en「cheap hotels in urayasu」18位・CTR0） |
| luggage | 旅マエ準備〜旅ナカ | 6 | 3 | 89 | 4 | 178 | 08-16 | 維持（荷物3部作の仕組み編） |
| kids | 旅マエ比較 | 6 | 1 | 20 | 0 | 150 | 06-16 | 維持 |
| compare | 旅マエ比較（ツール） | 3 | 1 | 6 | 0 | 144 | — | 維持 |
| access | 旅マエ比較 | 5 | 0 | 3 | 0 | 128 | 08-08 | **統合?**（access-guideと役割重複。詳細は発見事項A） |
| luggage-howto | 旅ナカ移動 | 5 | 3 | 97 | 6 | 84 | — | 維持（手順編） |
| types | 旅マエ比較 | 11 | 0 | 26 | 0 | 78 | 08-08 | 維持（被リンク最多の用語ハブ） |
| large-public-bath | 旅マエ比較 | 0 | 0 | 8 | 1 | 48 | 07-12 | 観察（設備逆引き群） |
| coin-laundry | 旅マエ比較 | 0 | 0 | 0 | 0 | 45 | 07-12 | 観察（同上） |
| airport-limousine | 旅マエ比較 | **0** | 0 | 18 | 0 | 13 | 07-12 | **統合?**（被リンク0・表示31。shuttle/accessと重複） |
| pool | 旅マエ比較 | 0 | 0 | 2 | 0 | 12 | 07-12 | 観察（設備逆引き群） |
| near-station | 旅マエ比較 | 0 | 0 | 2 | 0 | 2 | 07-12 | 観察（同上） |
| in-house-store | 旅マエ比較 | 0 | 0 | 0 | 0 | 1 | 07-12 | 観察（同上） |
| luggage-airport | 旅マエ準備 | 1 | 0 | 0 | 0 | 0 | 08-16公開 | 観察（公開翌日・データなしは正常） |

## 3. 個別ホテルページ（45軒・時間軸=旅マエ比較）

多言語表示順。列: 被リンク / jaC / jaI / mlC / mlI

| slug | 被 | jaC | jaI | mlC | mlI |
|---|---|---|---|---|---|
| hilton-tokyo-bay | 10 | 0 | 0 | 15 | 733 |
| brighton-tokyo-bay | 5 | 0 | 12 | 0 | 593 |
| comfort-suites-tokyo-bay | 2 | 0 | 10 | 11 | 240 |
| fantasy-springs-hotel | 10 | 0 | 6 | 8 | 225 |
| sheraton-grande-tokyo-bay | 9 | 0 | 6 | 12 | 203 |
| miracosta | 10 | 0 | 8 | 0 | 191 |
| oriental-tokyo-bay | 5 | 0 | 7 | 1 | 160 |
| dreamgate-maihama | 9 | 0 | 15 | 0 | 157 |
| royal-park-maihama | 4 | 0 | 30 | 2 | 140 |
| **grand-monday-resort-maihama** | **0** | **13** | **149** | 2 | 133 |
| emion-tokyo-bay | 6 | 0 | 7 | 0 | 120 |
| celebration-discover | 3 | 0 | 3 | 0 | 91 |
| toy-story-hotel | 7 | 0 | 6 | 0 | 84 |
| mystays-maihama | 7 | 0 | 3 | 2 | 81 |
| hyatt-regency-tokyo-bay | 4 | 0 | 9 | 0 | 70 |
| hotel-okura-tokyo-bay | 6 | 0 | 10 | 0 | 50 |
| urayasu-sun-hotel | 5 | 0 | 5 | 0 | 45 |
| eurasia-annex | 3 | 1 | 7 | 1 | 42 |
| celebration-wish | 11 | 1 | 5 | 0 | 42 |
| hotel-lumiere-kasai | 0 | 0 | 3 | 3 | 39 |
| bayhotel-urayasu | 5 | 0 | 2 | 0 | 35 |
| ambassador-hotel | 9 | 0 | 10 | 0 | 31 |
| cvs-bay-hotel | 0 | 0 | 5 | 1 | 29 |
| ibis-styles-tokyo-bay | 3 | 0 | 0 | 0 | 24 |
| viewfort-urayasu | 4 | 0 | 8 | 0 | 23 |
| flexstay-shin-urayasu | 3 | 0 | 11 | 1 | 23 |
| grand-nikko-tokyo-bay | 6 | 0 | 11 | 0 | 22 |
| maihama-hotel-first-resort | 9 | 0 | 17 | 0 | 21 |
| mitsui-garden-prana | 11 | 0 | 4 | 0 | 19 |
| maihama-eurasia | 6 | 0 | 6 | 0 | 19 |
| hiyori-hotel-maihama | 0 | 0 | 2 | 0 | 19 |
| hotel-seaside-edogawa | 1 | 0 | 0 | 2 | 18 |
| henna-hotel-maihama | 4 | 0 | 4 | 0 | 17 |
| maihama-view-hotel | 7 | 0 | 5 | 1 | 16 |
| tdl-hotel | 10 | 0 | 6 | 0 | 15 |
| mystays-shin-urayasu | 8 | 0 | 2 | 0 | 14 |
| hotel-ilfiore-kasai | 0 | 0 | 2 | 0 | 14 |
| hotel-ilfiore-kasai-annex | 0 | 1 | 4 | 1 | 13 |
| hoshinoresorts-1955-tokyo-bay | 6 | 0 | 22 | 0 | 13 |
| superhotel-myoden | 0 | 0 | 10 | 0 | 11 |
| livemax-kasai-ekimae | 0 | 0 | 0 | 0 | 9 |
| premium-monday-maihama-view-1 | 0 | 0 | 5 | 0 | 7 |
| lagent-tokyo-bay | 7 | 0 | 14 | 0 | 7 |
| four-stories-hotel | 4 | 1 | 41 | 0 | 7 |
| hotel-daigo-urayasu | 4 | 0 | 9 | 0 | 4 |

---

## 発見事項

### A. 統合・再編の検討対象（Phase 2の主戦場）

**アクセス系の重複**（最優先）
- [access-guide](../content/travel-guide/access-guide.md)（ml表示769・被リンク8）が明確に正。
- [hotels/access](../content/travel-guide/hotels/access.md)（表示計131）は「ホテル別のアクセス比較」で棲み分け可能だが、本文の「3. 空港アクセス」節が access-guide と重複。
- [airport-limousine](../content/travel-guide/hotels/airport-limousine.md) は**被リンク0・表示計31・見出しなしの一覧ページ**。shuttle か access への吸収候補筆頭。吸収時は `aliases` で301。

**設備逆引き群**（near-station / pool / in-house-store / coin-laundry / large-public-bath）
- 5本合計で表示108・クリック1・本文被リンク0（ハブのチップからのみ到達）。
- ただし公開1か月強で、ロングテールの受け皿という設計意図もある。**即統合ではなく3か月観察**→伸びなければ「設備で選ぶ」1本に統合が妥当。

**荷物3部作**（luggage / luggage-howto / luggage-airport）
- 現状カニバリの兆候なし。役割分担（仕組み/駅手順/空港発)は今回の再設計で明文化済み。**統合不要**。

### B. 実績があるのに導線がない（最も安い改善・即実行可）

| ページ | 実績 | 問題 |
|---|---|---|
| **grand-monday-resort-maihama** | **ja 13クリック**（ja個別ホテル全17クリックの76%）・表示149 | **本文被リンク0**。2026年開業系の新ホテルで検索需要が立っているのに、budget/kids等どのテーマ記事からも言及されていない |
| urayasu-maihama-shinurayasu-tourism | ml表示854（TG直下2位） | 本文被リンク0 |
| gourmet-guide | 表示計427 | 本文被リンク0 |
| four-stories-hotel | ja表示41 | 被リンク4だが少なめ。新顔で需要が立ち始めている |

### C. 表示は取れているのにクリックされない（改題・description改善）

- **en/shuttle**: 「urayasu hotels with shuttle」10.8位・表示128・クリック0。en タイトルが検索意図（無料送迎の有無を一覧で知りたい）に応えているか要点検
- **en/hotels ハブ**: 「hotels in urayasu」31.5位・表示341。ハブの en タイトル・meta を「Where to stay near Tokyo Disney」系に寄せる余地
- **en/budget**: 「cheap hotels in urayasu」18位・表示99・クリック0
- en 全体: 表示7,611に対しCTR 0.59%。**記事統合ではなくタイトル改善のトラック**で扱う

### D. 事実の重複マップ（統合ではなく単一情報源化の対象）

| 事実 | 記載記事数（ja） | 更新時の影響（×5言語） |
|---|---|---|
| リムジンバス羽田1,300円 | 37本 | 185ファイル |
| ハッピーエントリー制度 | 20本 | 100ファイル |
| リゾートライン | 13本 | 65ファイル |
| ボン・ヴォヤッジュ800円 | 9本 | 45ファイル |

→ 対処は記事統合ではなく **`data/` に定数化＋shortcode差し込み**（Phase 2で設計）。

### E. 意図的な設計（変更しない）

- pre-trip-checklist の日本語ナビ非表示はインバウンド専用設計のため意図的（2026-08-16 運営者確認）
- ファッションホテル3軒の名称のみ掲載ポリシー（CLAUDE.md 永続ルール）

---

## Phase 2 への推奨着手順

1. **導線修復（B群）** — grand-monday / tourism / gourmet への本文リンク追加。リスクゼロ・効果測定しやすい
2. **アクセス系の再編（A群）** — airport-limousine の吸収＋access の空港節を access-guide へ移譲。301必須
3. **en タイトル改善（C群）** — shuttle / hotels ハブ / budget の3本から
4. **事実の定数化（D群）** — リムジンバス料金から着手（影響最大のため）
5. 設備逆引き群は **2026-11 に再計測**して判断

## 計測メモ（再現手順）

- 被リンク: `content/travel-guide/**/*.md`（ja のみ）本文の `](/travel-guide/...)` を集計。ナビ・list.html は含まない
- GSC: ページ.csv を URL パスで ja / ml に分解して合算。クエリ×ページのクロスは未取得（カニバリ確定には GSC 画面でページフィルタ→クエリ確認が必要）
- 次回エクスポート時も同じフォルダ形式（ページ.csv / クエリ.csv）で可
