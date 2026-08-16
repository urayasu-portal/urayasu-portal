# Step 4｜全76記事の処遇マッピング（実装指示書）

作成日: 2026-08-16
入力: 棚卸し表（travel-guide-inventory.md）＋ ターゲットサイトマップ（02）＋ ウォークスルー（03）
処遇の定義: **維持**=触らない ／ **軽改修**=導線・リンク・改題のみ ／ **改稿**=構成の再編 ／ **移設**=URL変更（301） ／ **統合**=吸収して消滅（301） ／ **新設**

## サマリ

| 処遇 | 本数 | 内訳 |
|---|---|---|
| 維持 | 47 | 個別ホテル45＋compare＋pre-trip-checklist |
| 軽改修 | 15 | 導線修復・en/zh-tw改題・相互リンク |
| 改稿 | 5 | access-guide／tourism／hotels/access／disney-tickets／トップ_index |
| 移設 | 3 | 荷物3部作（hotels/→直下） |
| 統合（消滅） | 6 | airport-limousine＋設備逆引き5本 |
| 新設 | 3 | where-to-stay／facilities（設備で選ぶ）／access-by-car |
| **301リダイレクト** | **9 URL×5言語** | 移設3＋統合6 |

## ウェーブ計画

| ウェーブ | 柱 | 主な作業 | 前提 |
|---|---|---|---|
| **W0** | 基盤 | data/定数化＋shortcode（Step 5）。リムジンバス料金・ハッピーエントリー・荷物カウンター諸元 | なし |
| **W1** | 移動 | access-guide ハブ化改稿（T3診断・リムジン吸収・帰路）／airport-limousine 統合／荷物3部作 移設／taxi・tokyo-sightseeing 軽改修 | W0 |
| **W2** | 泊まる | where-to-stay 新設／facilities 新設（5本統合）／hotels/access 純化／budget・kids へ被リンク0ホテル追記／shuttle・budget・ハブ en改題 | W0 |
| **W3** | 滞在 | tourism ハブ化改稿／gourmet・spa・公園・teamlab・map 軽改修（導線＋戻り） | — |
| **W4** | トップ・準備 | トップ改稿（旅程4分岐）／横断ナビ再編／disney-tickets 改稿／access-by-car 新設／CLAUDE.md ルール恒久化 | W1〜W3のハブ完成後 |

各ウェーブの完了条件: ja改稿→4言語同期→301設定→内部リンク全数検証→ビルド確認。ウェーブ間で GSC 再計測（4〜6週）。

---

## 柱1｜計画・準備する

| 記事 | 実績（クリック/表示・全言語計） | 処遇 | W | 指示 |
|---|---|---|---|---|
| disney-tickets | 2/643 | **改稿** | W4 | 海外発行カード・海外からの購入手順を独立節に（P1/P2の入口）。en/zh-tw 改題 |
| happy-entry | 5/451 | 軽改修 | W4 | 準備柱への所属明示のみ。対象ホテル一覧→個別ページ合流は現状維持 |
| luggage-airport | 0/0（公開直後） | **移設** | W1 | `/travel-guide/luggage-airport/` へ。内容は2026-08-16作成の最新版のまま。aliases×5言語 |
| pre-trip-checklist | 0/4 | 維持 | — | インバウンド専用設計（ja非表示）を維持 |
| kids-emergency | 4/105 | 軽改修 | W3 | 滞在ハブ（tourism）からの副導線を追加。主所属は準備柱 |

## 柱2｜泊まる先を選ぶ

### テーマ記事

| 記事 | 実績 | 処遇 | W | 指示 |
|---|---|---|---|---|
| hotels/_index（ハブ） | 0/748 | 軽改修 | W2 | お困りごとカード先頭に where-to-stay 追加。荷物カードのリンク先を移設後URLへ |
| **where-to-stay** | — | **新設** | W2 | 浦安泊vs都心泊。診断型（日数×パーク日数→浦安泊/都心泊/分泊）。**en/zh-tw第一席**でタイトル設計（「hotels in urayasu」群 表示580超の受け皿）。結論から types/budget/shuttle/個別へ合流 |
| types | 0/104 | 軽改修 | W2 | 被リンク11の用語ハブとして維持。where-to-stay からの流入を受ける |
| budget | 0/401 | 軽改修 | W2 | **grand-monday-resort-maihama を追記**（ja個別クリックの76%を稼ぐのに被リンク0）。en「cheap hotels in urayasu」向け改題 |
| kids | 1/170 | 軽改修 | W2 | grand-monday・四季ホテル等の新顔を追記 |
| shuttle | 10/1,018 | 軽改修 | W2 | **TG最強ページ・構成は触らない**。en改題のみ（「urayasu hotels with shuttle」10.8位CTR0の回収）。トップ直リンク維持（検証Q3） |
| compare | 1/150 | 維持 | — | ツールとして現状維持 |
| hotels/access | 0/131 | **改稿** | ~~W2~~ **W3済** | 【2026-08-16変更】読んだ結果、空港節は「どのホテルの前に停留所があるか」＝ホテル別情報で access-guide と重複していなかった。移譲せず、見出しから価格を外して fact 化＋access-guide（ターミナル診断）と facilities#limousine（自動生成一覧）への相互リンクを追加する形で完了 |
| pool | 0/14 | **統合** | W2 | → facilities。301 |
| near-station | 0/4 | **統合** | W2 | → facilities。301 |
| in-house-store | 0/1 | **統合** | W2 | → facilities。301 |
| coin-laundry | 0/45 | **統合** | W2 | → facilities。301 |
| large-public-bath | 1/56 | **統合** | W2 | → facilities（筆頭セクション。温泉需要は spa 記事と相互リンク）。301 |
| **facilities** | — | **新設** | W2 | `/travel-guide/hotels/facilities/`「設備・こだわりで選ぶ」。大浴場／プール／駅近・直結／売店／コインランドリーの5節構成。5本の内容を吸収し、各節から該当ホテルの個別ページへ合流。ja/en のみ既存だった逆引きを5言語で新規展開 |
| airport-limousine | 0/31 | **統合** | W1 | → access-guide（柱3参照）。301 |
| luggage / luggage-howto | — | 移設 | W1 | 柱3参照 |

### 個別ホテル（45軒）

**全軒 維持**（URL・構成とも不変。収益設置面として温存）。ただし以下の**被リンク0の9軒**は、W2でテーマ記事側から文脈リンクを張る（個別ページ自体は触らない）:

grand-monday-resort-maihama（→budget・kids）／premium-monday-maihama-view-1（→budget）／hiyori-hotel-maihama（→budget）／cvs-bay-hotel（→budget）／superhotel-myoden（→budget）／livemax-kasai-ekimae（→budget）／hotel-lumiere-kasai（→budget・葛西系）／hotel-ilfiore-kasai・同annex（→葛西系・facilities）

## 柱3｜移動する

| 記事 | 実績 | 処遇 | W | 指示 |
|---|---|---|---|---|
| access-guide | 2/929 | **改稿（ハブ昇格）** | W1 | 冒頭を「どこに着きますか」診断に再編: 羽田T1/T2/T3・成田T1/T2/**T3**・東京駅・車の8分岐（G4）。airport-limousine の内容を「リムジンバス」節として吸収。帰路節を新設。荷物3部作への文脈リンク。**zh-tw第一席**で分岐ラベル設計（LCC・台湾便はT3/T2着） |
| airport-limousine | 0/31 | **統合** | ~~W1~~ **W2** | 【2026-08-16変更】実体は `layout: facility-list`（data駆動のホテル一覧）で、価値は「どのホテルにリムジンが停まるか」＝ホテル選びの情報。access-guide は手段としてのリムジンバス（運賃・のりば・予約）を吸収済みのため、ホテル一覧は **facilities に吸収**し301先も facilities に変更 |
| taxi-guide | 4/450 | 軽改修 | W1 | ハブからのスポーク導線を明示。構成は維持 |
| tokyo-sightseeing-access | 5/475 | 軽改修 | W1 | 同上。滞在ハブ（W3）からも副リンク |
| luggage | 7/267 | **移設＋軽改修** | W1 | `/travel-guide/luggage/` へ。3部作の役割分担注記を統一 |
| luggage-howto | 9/181 | **移設＋軽改修** | W1 | `/travel-guide/luggage-howto/` へ。同上 |
| **access-by-car** | — | **新設** | W4 | 車で行く（P3・ja優先）: 駐車場料金比較・渋滞・車中泊不可等。posts の地元ネタと連携。ja先行公開→他言語は需要見て判断 |

## 柱4｜滞在を楽しむ

| 記事 | 実績 | 処遇 | W | 指示 |
|---|---|---|---|---|
| tourism | 9/867 | **改稿（ハブ昇格）** | W3 | 「休息日の過ごし方」ハブに再定義。半日／1日／雨の日／子連れ の診断分岐から各スポットへ。URL不変（実績保護）。被リンク0の解消はW1〜W2の各記事からの文脈リンクで並行実施 |
| gourmet-guide | 8/427 | 軽改修 | W3 | ハブへの所属明示＋個別ホテル（食事なし素泊まり系）からの導線受け |
| maihama-eurasia-spa | 9/491 | 軽改修 | W3 | **ja直下最強（表示368）**。facilities 大浴場節と相互リンク。「舞浜 温泉」系クエリ（表示40超）の受けを改題で強化 |
| kasai-rinkai-park | 0/239 | 軽改修 | W3 | ハブ所属明示のみ |
| teamlab-planets | 4/132 | 軽改修 | W3 | 同上 |
| urayasu-traffic-park | 10/108 | 軽改修 | W3 | 同上 |
| urayasu-map | 0/44 | 軽改修 | W3 | 滞在ハブ＋個別ホテル「周辺情報」からの導線受け |

## トップ・ナビ

| 対象 | 処遇 | W | 指示 |
|---|---|---|---|
| /travel-guide/_index（トップ） | **改稿** | W4 | ヒーロー直下を旅程4分岐に。準備柱の記事リストを直下に持つ（柱1ハブ兼務）。**shuttle・budget・kids-emergency への直リンクは維持**（検証Q3/Q6/Q9の現状○を壊さない） |
| travel-guide-nav.html | 改修 | W4 | 4グループを旅程順に再編（計画・準備→泊まる→移動→滞在）。移設3本のURL更新 |
| hotels/list.html | 軽改修 | W2 | where-to-stay カード追加・荷物カードURL更新・設備チップを facilities 1本に |

## 301リダイレクト全リスト（9件×5言語）

| # | 旧URL | 新URL/吸収先 | W |
|---|---|---|---|
| 1 | /travel-guide/hotels/luggage/ | /travel-guide/luggage/ | W1 |
| 2 | /travel-guide/hotels/luggage-howto/ | /travel-guide/luggage-howto/ | W1 |
| 3 | /travel-guide/hotels/luggage-airport/ | /travel-guide/luggage-airport/ | W1 |
| 4 | /travel-guide/hotels/airport-limousine/ | /travel-guide/hotels/facilities/（2026-08-16に吸収先変更） | W2 |
| 5 | /travel-guide/hotels/pool/ | /travel-guide/hotels/facilities/ | W2 |
| 6 | /travel-guide/hotels/near-station/ | /travel-guide/hotels/facilities/ | W2 |
| 7 | /travel-guide/hotels/in-house-store/ | /travel-guide/hotels/facilities/ | W2 |
| 8 | /travel-guide/hotels/coin-laundry/ | /travel-guide/hotels/facilities/ | W2 |
| 9 | /travel-guide/hotels/large-public-bath/ | /travel-guide/hotels/facilities/ | W2 |

実装は Hugo `aliases:`（移設先・吸収先の frontmatter に旧URLを列挙）。設定後、旧URL→200確認と内部リンクの全数追随を機械検証。

## 統合により消滅する内容の保全

- airport-limousine・設備5本の本文は、統合先に**内容を吸収してから**301（情報は消さない）
- 統合前の全文はバックアップ（`urayasu-portal-backup/travel-guide-ja-2026-08-16/`）と git 履歴に残る

## Step 5（W0）への引き継ぎ

定数化する事実（初期セット）:
1. リムジンバス運賃（羽田1,300円／成田2,900円ほか）— 37記事に散在・最優先
2. ハッピーエントリー諸元（15分・対象区分）— 20記事
3. 荷物カウンター諸元（締切時刻・料金）— 荷物3部作＋access系
4. ボン・ヴォヤッジュ/ウェルカムセンター諸元（800円・受付時間）— 9記事

方式: `data/travel_facts.yaml` ＋ shortcode `{{</* fact "limousine.haneda_fare" */>}}`（インライン差し込み）。W0で仕組みとリムジンバス分を実装し、他はウェーブ内で記事に触るときに順次置換。
