# Step 2｜ターゲット構造＋posts連携仕様＋URL/301計画（生活ガイド）

作成日: 2026-08-16
入力: Step 0 決定・Step 1 マトリクス（二層構造・ペルソナ4・GAP6）

## 設計方針

- **URL＝住所、ハブとトップ＝動線**（旅行ガイドと同じ）。セクションは `/life-guide/` フラットのまま維持。スラッグの表記ゆれ（romaji/英語混在）は**美観だけの理由では直さない**（301の無駄）
- ハブは**ステージ4つ**、横断事象は**ハブを作らずトップ直下の高速導線**（現行 urgent 枠の拡張）
- 新設は最小限の**2本**。既存記事の「ハブ昇格改稿」を優先する

## 全体図（ターゲット状態）

```
/life-guide/                       ★トップ＝二段診断に改修
│  段1「あなたはどれですか」— ステージ4分岐
│  段2「いま困っていることは」— 横断6ボタン（urgent拡張）
│  段3  最新の生活ニュース（posts連動・自動枠）＋全ガイド一覧
│
├─ 入口A: 引っ越す・引っ越してきた（S1・P4・収益設置面）
│    ハブ = sumai-hikkoshi ◆チェックリスト型ハブに昇格改稿
│    spokes: city-hall-procedures / trash-recycling / station-life
│
├─ 入口B: 単身・ふたり暮らし（S2・P2）
│    ハブ = single-couple-life ★新設
│    spokes: station-life / urayasu-bus-kotsu / sports-teams /
│            libraries-public-facilities / urayasu-pet / urayasu-hoken-nenkin-zei
│
├─ 入口C: 子育て（S3〜S5・P1）
│    ハブ = urayasu-kosodate-shien-matome ◆ハブ昇格（軽〜中改修）
│    ステージ順シリーズ: ninshin-shussan → nyuyoji → hoiku-youchien →
│                        shougakusei-chuugakusei（◆前後リンクを機械的に整備）
│    横断spokes: kodomo-iryohi / jido-teate / hitorioya-shogai /
│               indoor-playgrounds / parks-playgrounds
│
├─ 入口D: シニア・介護（S6・P3）
│    kaigo-first-steps ★新設「親の介護が始まったら｜最初の一歩」（P3b向け・診断型）
│    urayasu-koreisha-kaigo ◆再構成（本人向け＋制度リファレンスに純化）
│
└─ 横断事象（トップ直下・高速導線のみ）
     急病 = holiday-night-medical ／ 災害 = disaster-prevention ／
     ごみ = trash-recycling ／ 手続き = city-hall-procedures ／
     お金 = urayasu-hoken-nenkin-zei ／ 移動 = urayasu-bus-kotsu
     （◆G6: この6本はCTR改善の診断型改修・改題の対象）
```

★=新設（2本） ◆=改稿・昇格

## posts⇔guide 連携の実装仕様（G4・本プロジェクト最大の新規要素）

### 部品1: ガイド側「このテーマの最新ニュース」自動枠

- パーシャル `layouts/partials/guide-related-news.html` を新設
- ガイド frontmatter に `newsTags: ["ごみ", "リサイクル"]` を定義。posts をタグで交差フィルタし**最新3〜5件を自動表示**（日付・タイトル・リンク）
- posts は毎日コミット→ビルドされるため、**ガイドは触らなくても常に最新**になる
- 該当ニュースが0件の期間は枠ごと非表示（空枠を出さない）

### 部品2: posts側「関連する常設ガイド」枠

- `data/guide_map.yaml` を新設: **タグ→ガイドURL のマッピング**（例: `ごみ: /life-guide/trash-recycling/`）
- posts のテンプレートに枠を追加: 記事のタグが guide_map にヒットしたら「📌 くわしくは常設ガイドへ」カードを自動表示。frontmatter `guide:` による手動指定も可（優先）
- **投稿者は既存のタグを付けるだけ**で導線が生まれる（手動リンク9本という現状を仕組みで置換）

### 部品3: 運用ルール（CLAUDE.md に恒久化・最終ウェーブ）

- posts 執筆時: 該当する生活テーマがあれば guide_map にあるタグを必ず付ける
- ガイド新設時: newsTags を定義し、guide_map に自分を登録する

### タグ設計の前提

posts の既存タグ体系と guide_map の突き合わせは W0 で実施（表記ゆれの正規化が必要な場合はここで吸収）。

## 新設ページ（2本）

| ページ | URL | 役割 |
|---|---|---|
| 単身・ふたり暮らしハブ | `/life-guide/single-couple-life/` | G1。散在素材6本を束ねる入口。「困ったときの3つ」（急病・ごみ・手続き）＋「浦安を楽しむ」（スポーツ・公園・図書館・posts枠）の二部構成。**ブックマークさせる**のが目標 |
| 親の介護が始まったら | `/life-guide/kaigo-first-steps/` | G2。P3b（子世帯・遠方含む）向け診断型。「まず地域包括支援センター『ともづな』に電話する」まで最短で導く。深い制度解説は koreisha-kaigo へ |

## 改稿・昇格（4本）

| 記事 | 内容 |
|---|---|
| sumai-hikkoshi | **転入チェックリストハブに昇格**。時系列диагnosis（引越し前2週間→当日→2週間以内→1か月）×手続き・ごみ・ライフライン。**収益設置面**（引越し一括見積・回線等。PR表記は akippa 方式踏襲） |
| kosodate-shien-matome | 子育てハブに昇格（現状もハブ的なので軽〜中改修）。ステージ順シリーズへの導線を先頭に |
| koreisha-kaigo | 本人向け＋制度リファレンスに純化。子世帯の最初の一歩は kaigo-first-steps へ分離 |
| 横断6本（急病・災害・ごみ・手続き・お金・バス） | 診断型への構成改修＋改題（G6: ごみ550表示4クリック等のCTR回収）。バスは「墓地公園 無料バス」系需要（G5）を節アンカー＋タイトル要素に昇格 |

## 収益設計（Step 0 決定5）

- **設置面は S1（転入・住まい）に限定**: sumai-hikkoshi ハブと station-life（エリア選び）
- 領域: 引越し一括見積・インターネット回線・不動産賃貸
- **置かない領域を明文化**: 子育て・介護・急病・防災（信頼が資産。将来も置かない）
- 表記: 既存 akippa 方式（`PR` バッジ＋affiliate-box＋注記）を踏襲

## URL/301計画

- **既存URLの移動・改名はゼロ**（フラット構造維持・スラッグ表記ゆれは容認）
- 新設2本のみ追加。統合・廃止候補（例: libraries／sports-teams を単身夫婦ハブに吸収するか）は **Step 4 の実測マッピングで確定**（現時点で予断しない）
- lifeguides.yaml は「ステージ別グルーピング」を追加する形で拡張（トップ改修時）

## ウェーブ計画（実装ロードマップ）

| W | 内容 | 理由 |
|---|---|---|
| W0 | posts連携部品（partial・guide_map・postsテンプレ枠）＋ life_facts.yaml 基盤＋タグ突き合わせ | **仕組みが先**。以降の全ウェーブが乗る |
| W1 | トップ二段診断化＋横断6本の診断型改修・改題 | 全ペルソナの入口。CTR回収（G5・G6） |
| W2 | 転入ハブ（sumai-hikkoshi昇格・収益設置） | 需要実証済み（G3）＋収益 |
| W3 | 単身・ふたり暮らしハブ新設＋スポーク軽改修 | G1（拡張方針の中核） |
| W4 | 子育て柱（ハブ昇格・ステージ前後リンク整備） | 既存の強みの強化 |
| W5 | シニア（kaigo-first-steps新設・koreisha-kaigo再構成） | G2 |
| W6 | CLAUDE.mdルール恒久化・総点検 | 締め |

各ウェーブの完了条件: 改稿→内部リンク全数検証→ビルド確認→コミット（jaのみのため多言語同期なし）。
