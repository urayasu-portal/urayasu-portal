# Step 2｜ターゲットサイトマップ＋URL/301計画

作成日: 2026-08-16
入力: Step 0 決定・Step 1 マトリクス（4本柱・設計原則5・GAP5）

## 設計方針（URLと動線を分離する）

- **URL＝住所、ハブとナビ＝動線。** 動線は自由に組めるため、URL移動は「将来の記事の置き場所が自明になる」「パンくず・セクション表示が整合する」場合にのみ行う。動線のためだけのURL移動はしない
- セクションは**2つだけ**維持する: `/travel-guide/`（ホテル以外・フラット）と `/travel-guide/hotels/`（ホテル選び）。柱ごとのディレクトリは作らない（Hugo の多層セクションは5言語分のテンプレート複雑化に見合わない）
- 4本柱は**ハブページと横断ナビ**で表現する
- 検索実績のあるURLは動かさない。動かすのは「住所が明確に間違っている」ものだけ

## 全体図（ターゲット状態）

```
/travel-guide/                          ★トップ＝「計画・準備」ハブを兼ねる
│
├─ 柱1: 計画・準備する（トップ直下に配置）
│    disney-tickets/                    チケット
│    hotels/happy-entry/               ハッピーエントリー（住所はhotels、動線は準備にも）
│    luggage-airport/                  ◆移設: hotels/→直下（空港から荷物）
│    pre-trip-checklist/               インバウンド専用（ja非表示維持）
│    kids-emergency/                   子どもの急病（お守り記事）
│
├─ 柱2: 泊まる先を選ぶ → ハブ = /travel-guide/hotels/（現状最強・URL不変）
│    hotels/where-to-stay/             ★新設G1: 浦安泊vs都心泊（en入口）
│    hotels/types|budget|kids|compare|access(改稿)|happy-entry
│    hotels/{設備逆引き5本}             統合候補群（Step4で判定）
│    hotels/{個別45軒}                  URL不変
│
├─ 柱3: 移動する → ハブ = urayasu-maihama-access-guide/（既存記事をハブ化）
│    urayasu-maihama-access-guide/     ◆改稿: ターミナル別の診断型に再編（G4）
│                                       ◆airport-limousine/ をここへ吸収（301）
│    urayasu-taxi-airport-flat-rate-guide/
│    tokyo-sightseeing-access/
│    luggage/                          ◆移設: hotels/→直下（舞浜駅の荷物・仕組み）
│    luggage-howto/                    ◆移設: hotels/→直下（舞浜駅の荷物・手順）
│    access-by-car/                    ★新設G2: 車で行く（ja優先・後期ウェーブ）
│
└─ 柱4: 滞在を楽しむ → ハブ = urayasu-maihama-shinurayasu-tourism/（既存記事をハブ化・URL不変）
     urayasu-gourmet-souvenir-guide/   グルメ・お土産
     maihama-eurasia-spa/              温泉
     kasai-rinkai-park/ teamlab-planets/ urayasu-traffic-park/
     urayasu-map/                      生活・買い物マップ
```

★=新設 ◆=URL移動または大規模改稿

## 各ハブの仕様

### トップ /travel-guide/ （改修）

- 現状: ヒーロー＋「旅の目的から探す」6カード。検索着地はほぼゼロ（表示計96）なので**自由に作り替えられる**
- ターゲット: ヒーローの直下を**「いま、どの段階ですか」の旅程4分岐**に変える（計画・準備／泊まる／移動／滞在）。準備系記事はトップ直下にリスト表示（柱1のハブを兼ねる）
- 2クリック保証: トップ→柱ハブ→全記事

### 泊まるハブ /travel-guide/hotels/ （小改修）

- 748ml表示の最強資産。**構造は変えない**
- 追加: where-to-stay への導線を「お困りごとカード」先頭に（en読者の入口の問いのため）
- 荷物カードは残す（動線として有効。リンク先URLだけ移設後に更新）

### 移動ハブ = access-guide（大改修・第1ウェーブの中心）

- **ハブ昇格＋診断型再編**: 冒頭を「どこに着きますか」の分岐にする（羽田T1/T2/T3・成田T1/T2/T3・東京駅・車）。**成田T3（LCC・台湾最優先ペルソナの入口）を初めて一級の分岐として扱う**（G4）
- 吸収: airport-limousine/（被リンク0・表示31）→ リムジンバス節として統合・301
- hotels/access からの移譲: 同記事の「空港アクセス」節を引き取る（hotels/access は「パーク・駅への近さ比較」に純化＝ホテル選び記事として存続）
- 帰路節を持つ（荷物記事の帰路と相互リンク）
- スポーク: taxi / tokyo-sightseeing / luggage 3部作 / by-car(新設)

### 滞在ハブ = tourism（中改修）

- ml表示854・被リンク0の孤立資産を**ハブに再定義**。URL不変（実績があるため）
- 構成: 「休息日の過ごし方」を軸に、半日／1日／雨の日／子連れ の分岐でスポークへ流す
- スポーク: gourmet / spa / 公園2本 / teamlab / urayasu-map

## URL変更・301計画（全リスト）

| 現URL | 新URL | 理由 | 措置 |
|---|---|---|---|
| /travel-guide/hotels/luggage/ | /travel-guide/luggage/ | 荷物は移動柱。hotels配下は住所違い | aliases で301・全言語 |
| /travel-guide/hotels/luggage-howto/ | /travel-guide/luggage-howto/ | 同上 | 同上 |
| /travel-guide/hotels/luggage-airport/ | /travel-guide/luggage-airport/ | 同上（準備柱） | 同上 |
| /travel-guide/hotels/airport-limousine/ | （消滅）→ access-guide に吸収 | 被リンク0・表示31・重複 | aliases を access-guide 側に付与・全言語 |

- 移設3本は第1ウェーブ（移動）で記事に触るタイミングで同時実施。内部リンクは全て grep で追随更新
- **これ以外の既存URLは動かさない**（hotels/45軒・tourism・access-guide 等、実績のあるURLはすべて現状維持）
- Step 4 のマッピングで統合が決まった記事は、その時点でこの表に追記

## 新設ページ（2本）

| ページ | URL | 柱 | 優先度 | 概要 |
|---|---|---|---|---|
| 浦安泊 vs 都心泊 | /travel-guide/hotels/where-to-stay/ | 泊まる | **高**（第2ウェーブ） | en の入口の問い（hotels in urayasu 群・表示580超の受け皿）。診断型: 日数×パーク日数→浦安泊/都心泊/分泊を提示→types/budget/shuttle/個別へ合流。**zh-tw/en を第一読者としてタイトル設計** |
| 車で行く | /travel-guide/access-by-car/ | 移動 | 中（後期） | P3向け。駐車場・料金・渋滞・車中泊NG等。posts の地元ネタと連携 |

## ナビゲーション再編

- 横断ナビ（travel-guide-nav.html）: 現4グループを旅程順に再編 —— **「計画・準備する」→「泊まる先を選ぶ」→「移動する」→「滞在を楽しむ」**。現グループとの対応: 準備と安心→柱1／ホテルを選ぶ→柱2／移動する→柱3／エリアを楽しむ→柱4（≒並べ替え＋所属修正で済む）
- トップの目的カード: 6カード→旅程4分岐に変更
- 全ページのパンくず・セクション表示は URL 構造（2セクション）のまま変更不要

## 収益合流の設計（Step 0 決定4）

- 柱1・2の全記事は**個別ホテルページへの合流点を必ず持つ**（例: where-to-stay→区分→個別、happy-entry→対象ホテル一覧→個別）
- 柱3・4の記事は「この近くに泊まるなら」の軽い戻り導線のみ（伴走性優先）
- 個別ホテルページが将来のアフィリエイト設置面（CLAUDE.md 既定方針）である前提を維持

## 未決事項（Step 4 へ送る）

1. 設備逆引き5本（pool/near-station/in-house-store/coin-laundry/large-public-bath）: 「設備で選ぶ」1本への統合 or 観察継続
2. compare（ツールページ）の位置づけ
3. kids-emergency を柱1（準備）と柱4（滞在中の急病）のどちらの動線を主とするか
4. luggage 3部作の相互の記述整理（移設時に同時実施）
