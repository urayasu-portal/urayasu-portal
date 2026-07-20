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

---

## 2026-07-15（第5回・ローテーション継続）

機械スキャンは前回と同一（セクション1・6は0件、2・3は店舗開店の持ち越し、404は0件）。factCheckedローテーションを3件消化。うち2件で事実の修正・補完あり。

### Web照合（factChecked付与3件・一次情報＝市公式）
| 記事 | 結果 | 対応 |
|---|---|---|
| urayasu-pet | 犬の登録期限・狂犬病注射・環境衛生課(047-712-6495・6階)は一致。**ドッグランが市内2か所**（浦安公園＝市役所向かい／運動公園隣の浦安ドッグラン）あるのに記事は浦安公園のみ記載だったため2か所に補完。利用条件（市内在住・畜犬登録・1年以内の狂犬病注射・混合ワクチン）も追記 | 本文補完＋factChecked＋lastmod更新 |
| urayasu-koreisha-kaigo | ともづな5センター2支所の名称・担当地区、猫実(047-381-9037)・浦安駅前(047-351-8950)・新浦安(047-306-5171)・高洲(047-382-2424)・東野支所(047-314-1085)・高齢者包括支援課(047-381-9028)は公式一致。**ともづな富岡の電話が誤り**（記事「047-355-5271」→公式「047-721-1027」）を訂正 | 本文修正＋factChecked＋lastmod更新 |
| urayasu-hitorioya-shogai | 金額・要件は全て公式委譲の構成。こども発達センター(総合福祉センター内)・障害児通所支援の公式リンク生存、構造的記述も正確 | 修正なし・factChecked付与 |

### 持ち越し更新
- **factChecked未設定 残り120件**: life-guide残り5件（urayasu-kosodate-shien-matome / urayasu-ninshin-shussan-shien / urayasu-nyuyoji-shien / urayasu-shougakusei-chuugakusei / urayasu-sumai-hikkoshi）＋ life-guide/_index ＋ travel-guide多言語群

---

## 2026-07-15（第6回・ローテーション継続）

機械スキャンは前回と同一（セクション1・6は0件、2・3は店舗開店の持ち越し、404は0件）。factCheckedローテーションを3件消化。

### Web照合（factChecked付与3件・一次情報＝市公式）
| 記事 | 結果 | 対応 |
|---|---|---|
| urayasu-ninshin-shussan-shien | 妊婦支援給付金(1回目5万円/妊婦・2回目5万円×胎児数・令和7年4月以降妊娠)、出産育児一時金(2023年4月〜50万円)、母子保健課(047-381-9034・健康センター1階)すべて公式一致 | 修正なし・factChecked付与 |
| urayasu-nyuyoji-shien | 母子保健課・こども発達センターは一致。子どもインフル助成の**公式リンク(1015846.html)が404**（季節事業でFY2025ページが会期後に取下げか）だったため、安定した親カテゴリ(kenko/yobou/index.html)へ張り替え。助成額2,000円は現行で維持 | リンク張替＋factChecked付与 |
| urayasu-sumai-hikkoshi | 新設4日目。初期費用の目安・転入14日・都市ガス=京葉ガス/電気=東京ガス新電力可などの編集事実は正確。A8アフィリンク・広告表記・物件有無(変動情報・ヘッジ済み)は対象外 | 修正なし・factChecked付与 |

### 持ち越し更新
- **factChecked未設定 残り117件**: life-guide残り2件（urayasu-kosodate-shien-matome / urayasu-shougakusei-chuugakusei）＋ life-guide/_index ＋ travel-guide多言語群。→ 次回で life-guide 記事本体はほぼ一巡完了
- 監視: urayasu-nyuyoji-shien の子どもインフル助成は季節事業。秋（10月ごろ）にFY2026ページが公開されたら、より具体的なページへの再リンクを検討

---

## 2026-07-21（臨時・電話番号総点検）

通常の月次ファクトチェック（確認日ローテーション）とは別に、サイト掲載の全電話番号を対象とした特別監査を実施（確認日の更新対象外）。並列エージェント21件でcontent全体＋facility-database.csv 213件＋hotel多言語相違6軒をWeb一次情報照合。

### 修正した誤り（9件）
| 対象 | 誤 | 正 |
|---|---|---|
| life-guide/urayasu-kosodate-shien-matome.md | 教育センター 047-305-2873 | 047-381-7961 |
| 同上 | 課名「こども未来部保育課」 | 「健康こども部保育幼稚園課」 |
| life-guide/parks-playgrounds.md | 公園緑地担当課 047-712-6437 | みどり公園課 047-712-6513 |
| facility-database.csv（サーティワン マーヴ浦安店） | 047-702-9631 | 050-1726-4843 |
| facility-database.csv（ドラッグセイムス舞浜店） | 047-316-0168 | 047-306-5561 |
| facility-database.csv（鳥貴族新浦安店） | 047-711-2625 | 050-1808-0599 |
| facility-database.csv（麺屋真星） | 要確認（空欄） | 047-316-7778（新規判明・補完） |
| travel-guide/hotels/hyatt-regency-tokyo-bay.{en,zh,zh-tw,ko}.md | 047-325-1234 | 047-305-1234 |
| travel-guide/hotels/grand-nikko-tokyo-bay.{en,zh,zh-tw,ko}.md | 047-354-1111 | 047-350-3533 |
| travel-guide/hotels/oriental-tokyo-bay.{en,zh,zh-tw,ko}.md | 047-381-7861 | 047-350-8111 |
| travel-guide/hotels/tdl-hotel.{en,zh,zh-tw,ko}.md | 047-305-5555（トイストーリーホテルの番号が誤混入） | 047-305-3333 |

### 一致確認（修正なし）
医療・救急8件／タクシー・介護タクシー13件／市役所窓口約30件／posts記事10件／facility-database.csv店舗約200件のうち上記以外は全て公式情報と一致。

### 据え置き（要確認のまま・推測で書き換えず）
- ともづな富岡本体047-721-1027は個別再確認で一致（訂正不要）
- facility-database.csv: poi-063（ファミリーマート エミオン東京ベイ／S店。同一施設内の別店舗emion-familymartとの検索混同の疑い）、poi-059（ファミリーマート新浦安マーレ店）、poi-072（ファーストセレクト）、poi-084（アール元気アクロスプラザ浦安東野店）、poi-103（マツモトキヨシ新浦安美浜店）、poi-131（はなまるうどんイオン新浦安店）、poi-147（バーミヤン浦安今川店）は一次情報が錯綜し確認不能。次回総点検時に再確認
