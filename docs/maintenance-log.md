# 情報鮮度監査ログ（/fact-check）

## 2026-07-12（初回）

### 機械スキャン結果
| 項目 | ヒット |
|---|---|
| 1. 期限切れイベント（eventDate過去＋予定表現） | 36件 |
| 2. 期日超過の予定表現（オープン予定等） | 7件 |
| 3. frontmatter矛盾（openDate過去＋予定表現） | 1件（マクドナルド新浦安明海店） |
| 4. 閉店施設への参照（check-facilities.ps1） | 0件 |
| 5. 内部リンク404 | 13件 |
| 6. 本文の日付直書き | 2件（access-guide / taxi-guide） |
| 7. factChecked未設定の固定記事 | 131件／356件 |

### 実施した修正（機械的・承認不要分）
- **内部リンク404 13件 → 0件**: ko/zh/zh-tw の access/gourmet/taxi ガイドをslug付き実URLへ（9件）、`/categories/グルメ・カフェ/`→`/categories/グルメカフェ/`、フウガドールすみだ戦・バックステージツアーのslug誤り、`/posts/urayasu-sports-guide/`→`/life-guide/sports-teams/`（3記事）
- **日付直書き削除 2件**: access-guide.md／taxi-guide.md の「最終確認日」を削除し factChecked へ移行（access=2026-07-05、taxi=2026-06-19）
- **期限切れイベントの過去形化 36件**: 「開催されます／開催予定」→過去形。児玉麻里＆児玉桃デュオ（eventDate=2026-01-31）は浦安音楽ホール公式で開催済みを確認のうえ過去形化
- **trash-recycling.md の市公式リンク切れ3本を現行URLへ**（市サイト再編による404: 分別辞典→dashikata/1012343、粗大ごみ申込→dashikata/sodai/1000383、クリーンセンター→clean/1000392）

### Web照合（一次情報で確認済み・記事修正は承認待ち）
| 記事 | 確認結果 | 根拠 |
|---|---|---|
| 焼肉きんぐ（浦安駅前） | 2026-06-30 マーヴ浦安店として開店 | 焼肉きんぐ公式 |
| ら～めん きんとうん | 2026-06-30 マーヴ浦安WESTに開店 | 流通ニュース・みん経 |
| リンツ ショコラ ブティック | マーヴ浦安店として開店（公式店舗一覧に掲載） | Lindt公式 |
| Yellow（オムライス） | マーヴ浦安WESTテナントとして6/30開業 | 流通ニュース |
| 浦安駅周辺新店まとめ | 上記各店開店により「予定」表現が陳腐化 | 同上 |
| スギ薬局 浦安さくら通り店 | 2026-05-21 開店（公式店舗ページあり） | スギ薬局公式 |
| Strawberry Fetish イクスピアリ | 2025-08-09開店、**2026-01-31までの期間限定営業（終了済み）** | PR TIMES・イクスピアリ |
| マクドナルド新浦安明海店 | 2026-06-30 開店 | 浦安経済新聞ほか |

### factChecked 付与・更新（7件）
- holiday-night-medical（急病診療所・歯科・#7119/#8000・Uダイヤル全て市公式/県公式と一致）
- urayasu-kodomo-iryohi（マル子: 高3相当・現物給付/償還払い一致）
- urayasu-jido-teate（児童手当: 高校生年代・15日特例一致）
- urayasu-bus-kotsu（おさんぽバス3路線・100円・都市計画課047-712-6542一致）
- trash-recycling（クリーンセンター220円/10kg・受付時間・粗大047-305-4000一致。リンク3本修正→lastmodも更新）
- access-guide / taxi-guide（直書き移行によるfactChecked付与。内容の再照合は未実施）

### 持ち越し
- **店舗開店8記事の本文書き換え**（オープン予定→開店済み）: 2026-07-12 ユーザー判断で今回は見送り。開店事実は上表で確認済みのため、次回は照合不要で書き換え可否のみ再確認。Strawberry Fetishは閉店（期間満了）の追記も要判断
- **factChecked未設定 残り126件**: 次回以降ローテーションで消化（life-guide残り17件＋travel-guide多言語群）
- 粗大ごみ受付センターの受付時間（月〜金9:00〜17:00と記載）: 公式で「土日祝除く」は確認、時刻の明記は未確認（2026-07-12）
- holiday-night-medical等の frontmatter `checkDate: "2026年6月"` はfactCheckedと重複気味。テンプレートでの利用有無を確認して整理を検討

---

## 2026-07-14（第2回）

> リポジトリ移動あり: 作業対象は `C:\Users\kadoh\OneDrive\ドキュメント\02-2 副業\urayasu-portal`（旧 Desktop\urayasu-portal は消失。第1回コミットは本リポジトリのHEAD祖先として取り込み済み）。以降この場所で運用。

### 機械スキャン結果（新規記事含む・today=2026-07-14）
| 項目 | ヒット |
|---|---|
| 1. 期限切れイベント | 0件（第1回で解消済み） |
| 2. 期日超過の予定表現 | 7件（＝店舗開店の持ち越し8記事。第1回から変化なし） |
| 3. frontmatter矛盾 | 1件（マクドナルド＝同上持ち越し） |
| 4. 閉店施設への参照 | 0件 |
| 5. 内部リンク404 | 21件（新規作業で増加）→ **20件修正・1件保留** |
| 6. 本文の日付直書き | 0件 |
| 7. factChecked未設定 | 132件／369件（新規記事分で微増） |

### 実施した修正
- **テンプレート修正** `layouts/travel-guide/hotels/list.html`: 「設備で探す」施設逆引きチップ群（日英のみ整備）が ko/zh/zh-tw でも出力され、存在しない現地語ページへ18リンク＝404。`{{ if or (eq $lang "ja") $isEN }}`で日英限定に。→18件解消
- **EN施設ページ2件**（airport-limousine.en / near-station.en）: `/en/travel-guide/access-guide/` → slug版 `/en/travel-guide/urayasu-maihama-access-guide/`。→2件解消
- **タグ`#`バグ**: 記事 20260714-ikspiari-club-cpla の tag `"CLUB #C-pla"` が slug `club-#c-pla` を生成し `#` でURL分断＝404。tagを `"CLUB C-pla"` に（店名表記の`#C-pla`は本文・タイトルで維持）。→1件解消

### Web照合（factChecked付与3件・一次情報＝市/県公式）
| 記事 | 結果 | 対応 |
|---|---|---|
| libraries-public-facilities | 公民館7館・図書館分館7つ・文化/スポーツ/予約等の公式リンク6本すべて生存・内容一致 | 修正なし・factChecked付与 |
| indoor-playgrounds | キッズスポーツルーム料金230/340円・時間・休館・電話、東野児童センターは一致。**高洲児童センターの開館時間が誤り**（記事「月〜金10-18/土日9-17」→公式は火〜日10-17・月曜休館）を修正 | 本文修正＋factChecked＋lastmod更新 |
| city-hall-procedures | 3行政サービスセンターの住所・電話・平日8:30-17:00は公式（2026-07-09更新）と一致。浦安駅前の建物名が「西友パート2」→公式「**トライアル西友**パート2」に更新 | 名称更新＋factChecked＋lastmod更新 |

### 持ち越し
- ~~内部リンク404 残り1件: JA `coin-laundry.md` → 未公開(draft)の pre-trip-checklist~~ → **2026-07-14 解消**: ユーザー判断でJA coin-laundryの該当リンク（1文）を削除。**内部リンク404は0件に**。pre-trip-checklist の JA版が draft のままな点は変更なし（英語版レビュー用の方針を維持）
- **店舗開店8記事**（第1回からの持ち越し）: 引き続き見送り中
- **factChecked未設定 残り129件**: 次回ローテーション（life-guide残り14件＋travel-guide多言語群＋新設 urayasu-sumai-hikkoshi）

---

## 2026-07-14（第3回・ローテーション継続）

機械スキャンは第2回と同一（セクション1・6は0件、2・3は店舗開店の持ち越し、404は0件）。factCheckedローテーションを3件消化。

### Web照合（factChecked付与3件・一次情報＝市公式/各チーム公式）
| 記事 | 結果 | 対応 |
|---|---|---|
| disaster-prevention | 避難所/ハザードマップ/防災アプリの公式リンク・危機管理課(047-712-6897・市役所4階)すべて生存＆一致。概念説明も正確 | 修正なし・factChecked付与 |
| sports-teams | チーム名(ブリオベッカ浦安・市川)・リーグ(JFL/F1/リーグワン)・会場は各公式と一致。**浦安Dパークの所在地が誤り**（記事「北栄1-1-1」→公式「高洲8-2-1」）を訂正 | 本文修正＋factChecked＋lastmod更新 |
| parks-playgrounds | 交通公園(美浜2-15-1・9:00-16:30・月曜休・無料・63台)、こどもの広場(高洲2-4-10・水〜金10-17/土日祝9-17・月火休・61台)は公式と完全一致 | 修正なし・factChecked付与 |

### 持ち越し更新
- **factChecked未設定 残り126件**: life-guide残り11件（station-life / urayasu-hitorioya-shogai / urayasu-hoiku-youchien / urayasu-hoken-nenkin-zei / urayasu-koreisha-kaigo / urayasu-kosodate-shien-matome / urayasu-ninshin-shussan-shien / urayasu-nyuyoji-shien / urayasu-pet / urayasu-shougakusei-chuugakusei / urayasu-sumai-hikkoshi）＋ life-guide/_index ＋ travel-guide多言語群

---

## 2026-07-15（第4回・ローテーション継続）

機械スキャンは前回と同一（セクション1・6は0件、2・3は店舗開店の持ち越し、404は0件）。factCheckedローテーションを3件消化。今回はいずれも内容一致で本文修正なし。

### Web照合（factChecked付与3件・一次情報＝市公式）
| 記事 | 結果 | 対応 |
|---|---|---|
| urayasu-hoken-nenkin-zei | 各課直通6件（国保年金課047-712-6829・保険税係6280・後期高齢係6274・市民税課6212・固定資産税課6065・収税課6229）を市ダイヤルイン一覧で照合、全一致 | 修正なし・factChecked付与 |
| station-life | 変動情報なし。路線(東西線/京葉線・武蔵野線)・商業施設(アトレ/MONA/イオン/ニューコースト/イクスピアリ)いずれも現存・正確 | 修正なし・factChecked付与 |
| urayasu-hoiku-youchien | **0〜2歳児クラス保育料無償化（2026-04-01から・年齢/課税/きょうだい問わず・給食費別）**を公式で確認、記載と完全一致。3〜5歳無償化も標準どおり | 修正なし・factChecked付与 |

### 持ち越し更新
- **factChecked未設定 残り123件**: life-guide残り8件（urayasu-hitorioya-shogai / urayasu-koreisha-kaigo / urayasu-kosodate-shien-matome / urayasu-ninshin-shussan-shien / urayasu-nyuyoji-shien / urayasu-pet / urayasu-shougakusei-chuugakusei / urayasu-sumai-hikkoshi）＋ life-guide/_index ＋ travel-guide多言語群
