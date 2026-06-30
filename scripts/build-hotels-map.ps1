<#
.SYNOPSIS
  hotel-database-full.csv（唯一のマスター）から data/hotels_map.yaml を生成する。

.DESCRIPTION
  ホテルの座標・機能フラグ・最低価格は CSV に集約されている。
  比較マップ（/travel-guide/hotels/compare/）が参照する data/hotels_map.yaml は
  本スクリプトで生成する自動生成物であり、直接編集しないこと。

  座標やフラグを変更したいときは：
    1. hotel-database-full.csv を Excel / Google Sheets で編集
    2. 本スクリプトを実行して data/hotels_map.yaml を再生成
    3. hugo でビルド

  CSV の関連列：
    slug        … 一意キー（必須。空の行＝name-only等はスキップ）
    緯度 / 経度  … 数値。緯度が空の行は地図対象外としてスキップ
    機能フラグ    … セミコロン区切り（例 "shuttle;bath;limousine"）→ YAML配列に変換
    最低価格      … ソート用の整数（円）。空なら 0

.EXAMPLE
  powershell -File scripts/build-hotels-map.ps1
#>

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root    = Split-Path $PSScriptRoot -Parent
$csvPath = Join-Path $root "hotel-database-full.csv"
$outPath = Join-Path $root "data\hotels_map.yaml"

if (-not (Test-Path $csvPath)) { throw "マスターCSVが見つかりません: $csvPath" }

$csv = Import-Csv $csvPath -Encoding UTF8

# ホテル名の中文表記（slug→简体中文）。比較マップ(/zh/)のポップアップ・地図用。
# ※ build-hotels.ps1 の $nameZh と同内容。どちらか変更時は両方更新すること。
$nameZh = @{
  "tdl-hotel"                     = "东京迪士尼乐园大饭店"
  "miracosta"                     = "东京迪士尼海洋观海景大饭店 米拉柯斯达"
  "fantasy-springs-hotel"         = "东京迪士尼海洋梦幻泉乡大饭店"
  "ambassador-hotel"              = "迪士尼大使大饭店"
  "toy-story-hotel"               = "东京迪士尼度假区玩具总动员饭店"
  "celebration-wish"              = "东京迪士尼欢庆饭店：愿望"
  "celebration-discover"          = "东京迪士尼欢庆饭店：探索"
  "hotel-okura-tokyo-bay"         = "东京湾大仓酒店"
  "grand-nikko-tokyo-bay"         = "东京湾舞滨格兰日航酒店"
  "sheraton-grande-tokyo-bay"     = "东京湾喜来登大酒店"
  "hilton-tokyo-bay"              = "东京湾希尔顿酒店"
  "maihama-hotel-first-resort"    = "东京湾舞滨酒店 第一度假村"
  "maihama-view-hotel"            = "舞滨观景酒店 by HULIC"
  "dreamgate-maihama"             = "舞滨梦想之门酒店"
  "royal-park-maihama"            = "舞滨皇家花园酒店 东京湾"
  "mystays-maihama"               = "舞滨MyStays酒店"
  "maihama-eurasia"               = "SPA&HOTEL 舞滨欧亚"
  "eurasia-annex"                 = "HOTEL 欧亚舞滨 ANNEX"
  "hyatt-regency-tokyo-bay"       = "东京湾凯悦酒店"
  "comfort-suites-tokyo-bay"      = "东京湾凯富套房酒店"
  "brighton-tokyo-bay"            = "浦安布莱顿酒店 东京湾"
  "oriental-tokyo-bay"            = "东京湾东方酒店"
  "emion-tokyo-bay"               = "东京湾艾米恩酒店"
  "mitsui-garden-prana"           = "三井花园酒店 普拉纳东京湾"
  "hoshinoresorts-1955-tokyo-bay" = "星野集团 1955 东京湾"
  "lagent-tokyo-bay"              = "东京湾拉珍特酒店"
  "ibis-styles-tokyo-bay"         = "东京湾宜必思尚品酒店"
  "mystays-shin-urayasu"          = "新浦安MyStays会议中心酒店"
  "flexstay-shin-urayasu"         = "新浦安Flexstay Inn"
  "henna-hotel-maihama"           = "海茵娜酒店 舞滨东京湾"
  "four-stories-hotel"            = "舞滨四物语酒店 东京湾"
  "hiyori-hotel-maihama"          = "舞滨日和酒店"
  "viewfort-urayasu"              = "浦安景堡酒店"
  "hotel-daigo-urayasu"           = "醍醐酒店"
  "bayhotel-urayasu"              = "浦安站前 BAY HOTEL"
  "urayasu-sun-hotel"             = "浦安阳光酒店"
  "premium-monday-maihama-view-1" = "Premium hotel MONday 舞滨景观Ⅰ"
  "hotel-seaside-edogawa"         = "江户川海滨酒店"
  "cvs-bay-hotel"                 = "CVS·BAY HOTEL"
  "hotel-ilfiore-kasai"           = "葛西菲奥雷酒店"
  "hotel-ilfiore-kasai-annex"     = "葛西菲奥雷酒店 ANNEX"
  "hotel-lumiere-kasai"           = "葛西卢米埃尔酒店"
  "livemax-kasai-ekimae"          = "LiVEMAX葛西站前酒店"
  "superhotel-myoden"             = "超级酒店 东西线·市川·妙典站前"
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# === 自動生成ファイル / DO NOT EDIT ===")
[void]$sb.AppendLine("# マスター: hotel-database-full.csv")
[void]$sb.AppendLine("# 生成:     scripts/build-hotels-map.ps1")
[void]$sb.AppendLine("# 座標・フラグ・最低価格を変えるときはCSVを編集して本スクリプトで再生成すること。")
[void]$sb.AppendLine("# flags: bath=大浴場・温泉, pool=室内プール, laundry=コインランドリー,")
[void]$sb.AppendLine("#         convenience=館内売店, shuttle=無料シャトル, station=駅直結/徒歩1分,")
[void]$sb.AppendLine("#         limousine=空港リムジン, kitchen=ミニキッチン")
[void]$sb.AppendLine("# facilities: 個別ページの設備アイコン用（key + 任意のnote）。CSV機能フラグの key:note を展開。")
[void]$sb.AppendLine("# booking: 予約リンク（rakuten/jalan/booking/agoda）。CSVの各URL列に値がある時だけ出力。")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("hotels:")

$count = 0
foreach ($r in $csv) {
  if ($r."掲載区分" -eq "名称・カテゴリのみ掲載") { continue }  # 名称のみ掲載は地図対象外（座標があっても出さない）
  $slug = ($r.slug).Trim()
  if (-not $slug) { continue }                 # slug無し（name-only等）はスキップ
  $lat = ($r."緯度").Trim()
  $lng = ($r."経度").Trim()
  if (-not $lat -or -not $lng) { continue }    # 座標無しは地図対象外

  $pm = 0
  if (($r."最低価格").Trim() -match '^[0-9]+$') { $pm = [int]($r."最低価格").Trim() }

  # 機能フラグを key / key:note の配列にパース
  $items = @()
  $fraw = ($r."機能フラグ").Trim()
  if ($fraw) {
    foreach ($f in ($fraw -split ';' | Where-Object { $_.Trim() })) {
      $kv = $f.Trim() -split ':', 2
      $note = ""
      if ($kv.Count -gt 1) { $note = $kv[1].Trim() }
      $items += [pscustomobject]@{ key = $kv[0].Trim(); note = $note }
    }
  }
  # flags: note を外した素のキー配列（比較マップ・フィルタ用）
  $flags = (($items | ForEach-Object { $_.key }) -join ', ')

  [void]$sb.AppendLine("  - slug: ""$slug""")
  [void]$sb.AppendLine("    lat: $lat")
  [void]$sb.AppendLine("    lng: $lng")
  [void]$sb.AppendLine("    price_min: $pm")
  [void]$sb.AppendLine("    flags: [$flags]")
  # facilities: 個別ページの設備アイコン用（key + 任意note）
  if ($items.Count -gt 0) {
    [void]$sb.AppendLine("    facilities:")
    foreach ($it in $items) {
      [void]$sb.AppendLine("      - key: ""$($it.key)""")
      if ($it.note) { [void]$sb.AppendLine("        note: ""$($it.note)""") }
    }
  } else {
    [void]$sb.AppendLine("    facilities: []")
  }
  # 予約リンク（アフィリエイト）: CSVに値があるものだけ出力（未登録時は空で何も出さない）
  $bk = @()
  if (($r.'楽天トラベルURL').Trim()) { $bk += "      rakuten: ""$(($r.'楽天トラベルURL').Trim())""" }
  if (($r.'じゃらんURL').Trim())     { $bk += "      jalan: ""$(($r.'じゃらんURL').Trim())""" }
  if (($r.'BookingURL').Trim())      { $bk += "      booking: ""$(($r.'BookingURL').Trim())""" }
  if (($r.'AgodaURL').Trim())        { $bk += "      agoda: ""$(($r.'AgodaURL').Trim())""" }
  if ($bk.Count -gt 0) {
    [void]$sb.AppendLine("    booking:")
    foreach ($b in $bk) { [void]$sb.AppendLine($b) }
  }
  [void]$sb.AppendLine("    name: ""$($r.'施設名')""")
  [void]$sb.AppendLine("    address: ""$($r.'住所')""")
  $nameEn = ($r.'英語表記').Trim()
  if (-not $nameEn) { $nameEn = ($r.'施設名').Trim() }
  [void]$sb.AppendLine("    name_en: ""$nameEn""")
  $nameZhV = ""
  if ($nameZh.ContainsKey($slug)) { $nameZhV = $nameZh[$slug] }
  if (-not $nameZhV) { $nameZhV = ($r.'施設名').Trim() }
  [void]$sb.AppendLine("    name_zh: ""$nameZhV""")
  $count++
}

# BOMなしUTF-8で書き出し（HugoのYAMLパーサ対策）
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), $utf8NoBom)

Write-Output "生成完了: $outPath"
Write-Output "出力ホテル数: $count / CSV総行数: $($csv.Count)"
