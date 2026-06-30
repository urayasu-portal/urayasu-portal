<#
.SYNOPSIS
  hotel-database-full.csv（唯一のマスター）から data/hotels.yaml を生成する。

.DESCRIPTION
  ホテルの区分・カテゴリ・特徴・価格目安は CSV に集約されている。
  ホテル一覧(list)・比較マップ(compare)が参照する data/hotels.yaml は
  本スクリプトで生成する自動生成物であり、直接編集しないこと。

  区分やカテゴリを変えたいときは：
    1. hotel-database-full.csv を Excel / Google Sheets で編集
    2. 本スクリプトを実行して data/hotels.yaml を再生成
    3. hugo でビルド

  CSV列 → hotels.yaml フィールドの対応：
    表示名      → name（一覧・比較マップに出す短い名前。空なら施設名で代替）
    カテゴリ     → category（TDR公式区分に準拠：ディズニー/オフィシャル/パートナー/グッドネイバー/その他。ファッションは「—」）
    最低価格     → price_guide（"¥N〜"。0/空は ""）
    特徴ラベル    → feature
    掲載区分     → policy（通常掲載=normal / 名称・カテゴリのみ掲載=name-only）
    エリア記号    → どのエリアに属するか
  エリアの見出し・説明文(note)は本スクリプト内の定数で保持（CSVには無い）。

.EXAMPLE
  powershell -File scripts/build-hotels.ps1
#>

$ErrorActionPreference = "Stop"
$root    = Split-Path $PSScriptRoot -Parent
$csvPath = Join-Path $root "hotel-database-full.csv"
$outPath = Join-Path $root "data\hotels.yaml"

if (-not (Test-Path $csvPath)) { throw "マスターCSVが見つかりません: $csvPath" }
$csv = Import-Csv $csvPath -Encoding UTF8

# エリア定義（順序・見出し・説明文）。count はCSVから自動算出。
# name_en / note_en … 英語サイト(/en/)用。日本語をベースに、インバウンド向けに簡潔化。
$areas = @(
  [ordered]@{ id="a"; tag="A"; group="リゾート";   name="舞浜エリア";   note="ディズニーホテル・オフィシャル集中。パーク最至近。"; name_en="Maihama";       note_en="Disney & Official hotels, closest to the parks."; name_zh="舞滨地区";   note_zh="迪士尼饭店与官方饭店集中，离乐园最近。" }
  [ordered]@{ id="b"; tag="B"; group="リゾート";   name="千鳥エリア";   note="マイステイズ舞浜はTDS徒歩6分・最安値クラス。"; name_en="Chidori";       note_en="MYSTAYS Maihama is a 6-min walk to TDS, best-value class."; name_zh="千鸟地区";   note_zh="MyStays舞滨步行6分钟到迪士尼海洋，价位实惠。" }
  [ordered]@{ id="c"; tag="C"; group="ベイサイド"; name="新町エリア";   note="日の出・明海のパートナーホテル集中。無料シャトル・空港リムジンも便利。"; name_en="Shinmachi";     note_en="Partner hotels in Hinode/Akemi. Free shuttles & airport limousines."; name_zh="新町地区";   note_zh="日出·明海的合作饭店集中，免费班车与机场巴士便利。" }
  [ordered]@{ id="d"; tag="D"; group="ベイサイド"; name="新浦安エリア"; note="新浦安駅周辺（美浜・今川・東野）。京葉線で舞浜まで2駅。"; name_en="Shin-Urayasu";  note_en="Around Shin-Urayasu Stn. Two stops to Maihama on the Keiyo Line."; name_zh="新浦安地区"; note_zh="新浦安站周边（美浜·今川·东野）。京叶线到舞滨2站。" }
  [ordered]@{ id="e"; tag="E"; group="リバーサイド"; name="元町エリア";   note="富士見など旧市街南側。旧江戸川沿いの落ち着いた住宅エリア。"; name_en="Motomachi";     note_en="Old-town south side along the Edogawa. Quiet residential area."; name_zh="元町地区";   note_zh="富士见等旧城区南侧。旧江户川沿岸的安静住宅区。" }
  [ordered]@{ id="f"; tag="F"; group="リバーサイド"; name="浦安駅エリア"; note="東西線直通で都心1本。パークへはバス25〜30分。"; name_en="Urayasu Stn";   note_en="Direct to central Tokyo on the Tozai Line. 25-30 min by bus to the parks."; name_zh="浦安站地区"; note_zh="东西线直达市中心。到乐园乘巴士约25–30分钟。" }
  [ordered]@{ id="g"; tag="G"; group="浦安近郊";   name="浦安近郊";   note="葛西・市川・妙典など隣接エリア。電車で浦安・舞浜へ。"; name_en="Near Urayasu";  note_en="Adjacent Kasai/Ichikawa/Myoden. Train to Urayasu & Maihama."; name_zh="浦安近郊";   note_zh="葛西·市川·妙典等邻接地区。乘电车前往浦安·舞滨。" }
)

# 特徴ラベルの英訳（slug→英語）。英語サイトの一覧・比較マップ用。
# CSVの「特徴ラベル」(日本語)に対応。新規ホテル追加時はここにも1行加える。
$featureEn = @{
  "tdl-hotel"                     = "1-min walk to TDL"
  "miracosta"                     = "Inside TDS, private entrance"
  "fantasy-springs-hotel"         = "Connected to TDS Fantasy Springs (opened 2024)"
  "ambassador-hotel"              = "8-min walk from Maihama Stn"
  "toy-story-hotel"               = "3-min walk from Bayside Station"
  "celebration-wish"              = "Happy Entry perk included"
  "celebration-discover"          = "Happy Entry perk included"
  "hotel-okura-tokyo-bay"         = "Dedicated park shuttle"
  "grand-nikko-tokyo-bay"         = "Dedicated park shuttle"
  "sheraton-grande-tokyo-bay"     = "Large public bath & big pool"
  "hilton-tokyo-bay"              = "24h in-house convenience store"
  "maihama-hotel-first-resort"    = "Coin laundry on-site"
  "dreamgate-maihama"             = "Direct to JR Maihama Stn gate"
  "maihama-view-hotel"            = "Large public bath 'Spa Rose'"
  "royal-park-maihama"            = "Opened Feb 2026, up to 6 guests"
  "mystays-maihama"               = "6-min walk to TDS, area's best value"
  "maihama-eurasia"               = "Hot spring, open-air bath & sauna"
  "eurasia-annex"                 = "Discounted access to main-building hot spring"
  "hyatt-regency-tokyo-bay"       = "Limousine stop at hotel (new 2024)"
  "comfort-suites-tokyo-bay"      = "Shuttle 30 min after closing, kids sleep free"
  "brighton-tokyo-bay"            = "Direct to Shin-Urayasu Stn"
  "oriental-tokyo-bay"            = "Direct to Shin-Urayasu Stn"
  "emion-tokyo-bay"               = "Hot spring & open-air bath"
  "mitsui-garden-prana"           = "View public bath & in-house store"
  "hoshinoresorts-1955-tokyo-bay" = "In-house Lawson, opened 2024"
  "lagent-tokyo-bay"              = "Up to 6 guests, 24h store next door"
  "ibis-styles-tokyo-bay"         = "Accor design hotel"
  "mystays-shin-urayasu"          = "Reliably low rates"
  "flexstay-shin-urayasu"         = "Mini-kitchen in every room, long-stay"
  "henna-hotel-maihama"           = "Maihama Stn shuttle (reduced from Jul 2026)"
  "four-stories-hotel"            = "Local bus access (last bus 23:00)"
  "hiyori-hotel-maihama"          = "Foot massager & shoe dryer in every room"
  "viewfort-urayasu"              = "1-min walk from Urayasu Stn, buffet breakfast"
  "hotel-daigo-urayasu"           = "Flat rate year-round, no peak surcharge"
  "bayhotel-urayasu"              = "Kitchen, fridge & washer in every room"
  "urayasu-sun-hotel"             = "Free breakfast, 24h front desk"
  "premium-monday-maihama-view-1" = "Opened Dec 2025, free TDR shuttle"
  "hotel-seaside-edogawa"         = "In Kasai Rinkai Park, 3-min walk, tatami rooms"
  "cvs-bay-hotel"                 = "Next to Ichikawa-Shiohama Stn, 2 stops to Maihama"
  "hotel-ilfiore-kasai"           = "3-min walk from Kasai Stn, up to 5 guests"
  "hotel-ilfiore-kasai-annex"     = "3-min walk from Kasai Stn, Il Fiore annex"
  "hotel-lumiere-kasai"           = "Business hotel, 2-min walk from Kasai Stn"
  "livemax-kasai-ekimae"          = "3-min walk from Kasai Stn, ~20 min bus to TDR"
  "superhotel-myoden"             = "By Myoden Stn, Tozai Line to Urayasu"
}

# 特徴ラベルの中文訳（slug→简体中文）。中国語サイト(/zh/)の一覧・比較マップ用。
$featureZh = @{
  "tdl-hotel"                     = "步行1分钟到迪士尼乐园"
  "miracosta"                     = "位于迪士尼海洋园区内·专用入口"
  "fantasy-springs-hotel"         = "直通迪士尼海洋梦幻泉乡（2024年开业）"
  "ambassador-hotel"              = "距舞滨站步行8分钟"
  "toy-story-hotel"               = "距海湾站步行3分钟"
  "celebration-wish"              = "含Happy Entry提前入园礼遇"
  "celebration-discover"          = "含Happy Entry提前入园礼遇"
  "hotel-okura-tokyo-bay"         = "专用乐园班车"
  "grand-nikko-tokyo-bay"         = "专用乐园班车"
  "sheraton-grande-tokyo-bay"     = "大浴场与大型泳池"
  "hilton-tokyo-bay"              = "馆内24小时便利店"
  "maihama-hotel-first-resort"    = "馆内自助洗衣"
  "dreamgate-maihama"             = "直通JR舞滨站检票口"
  "maihama-view-hotel"            = "大浴场「Spa Rose」"
  "royal-park-maihama"            = "2026年2月开业·最多入住6人"
  "mystays-maihama"               = "步行6分钟到迪士尼海洋·区域内超值"
  "maihama-eurasia"               = "天然温泉·露天浴池与桑拿"
  "eurasia-annex"                 = "可优惠使用本馆温泉"
  "hyatt-regency-tokyo-bay"       = "饭店门口设机场巴士站（2024新设）"
  "comfort-suites-tokyo-bay"      = "闭园后30分钟班车·儿童免费同住"
  "brighton-tokyo-bay"            = "直通新浦安站"
  "oriental-tokyo-bay"            = "直通新浦安站"
  "emion-tokyo-bay"               = "天然温泉与露天浴池"
  "mitsui-garden-prana"           = "景观大浴场与馆内商店"
  "hoshinoresorts-1955-tokyo-bay" = "馆内罗森便利店·2024开业"
  "lagent-tokyo-bay"              = "最多6人·隔壁24小时便利店"
  "ibis-styles-tokyo-bay"         = "雅高集团设计饭店"
  "mystays-shin-urayasu"          = "价位稳定实惠"
  "flexstay-shin-urayasu"         = "每间客房带小厨房·适合长住"
  "henna-hotel-maihama"           = "舞滨站班车（2026年7月起减班）"
  "four-stories-hotel"            = "巴士接驳（末班23:00）"
  "hiyori-hotel-maihama"          = "每间客房备足部按摩与烘鞋机"
  "viewfort-urayasu"              = "距浦安站步行1分钟·自助早餐"
  "hotel-daigo-urayasu"           = "全年统一房价·旺季不涨"
  "bayhotel-urayasu"              = "每间客房带厨房·冰箱与洗衣机"
  "urayasu-sun-hotel"             = "免费早餐·24小时前台"
  "premium-monday-maihama-view-1" = "2025年12月开业·免费迪士尼班车"
  "hotel-seaside-edogawa"         = "位于葛西临海公园·步行3分钟·有榻榻米房"
  "cvs-bay-hotel"                 = "紧邻市川盐浜站·到舞滨2站"
  "hotel-ilfiore-kasai"           = "距葛西站步行3分钟·最多5人"
  "hotel-ilfiore-kasai-annex"     = "距葛西站步行3分钟·Il Fiore别馆"
  "hotel-lumiere-kasai"           = "商务饭店·距葛西站步行2分钟"
  "livemax-kasai-ekimae"          = "距葛西站步行3分钟·乘巴士约20分钟到迪士尼"
  "superhotel-myoden"             = "妙典站旁·乘东西线可达浦安"
}

# ホテル名の中文表記（slug→简体中文）。ディズニー直営は東京ディズニー公式简体中文サイト(/sc/)の官方名称、
# チェーン系は各ブランドの標準中文名、その他は一般的な表記。空はdispName(日本語名)で代替。
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

# CSVカテゴリ → 表示用カテゴリ（TDR公式の区分に準拠）
#   ディズニーホテル / オフィシャルホテル / パートナーホテル / グッドネイバーホテル / その他のホテル
#   ファッションホテルは区分を表示せず「—」（名称・エリアのみ掲載の方針）
$catMap = @{
  "ディズニーホテル"     = "ディズニーホテル"
  "オフィシャルホテル"   = "オフィシャルホテル"
  "パートナーホテル"     = "パートナーホテル"
  "グッドネイバーホテル" = "グッドネイバーホテル"
  "その他のホテル"       = "その他のホテル"
  "ファッションホテル"   = "—"
}

function Convert-Category($r) {
  $c = $r."カテゴリ"
  if ($catMap.ContainsKey($c)) { return $catMap[$c] }
  return $c
}
function Convert-Price($r) {
  $pm = ($r."最低価格").Trim()
  if ($pm -match '^\d+$' -and [int]$pm -gt 0) { return ("¥{0:N0}〜" -f [int]$pm) }
  return ""
}
function Convert-Policy($r) {
  if ($r."掲載区分" -eq "名称・カテゴリのみ掲載") { return "name-only" }
  return "normal"
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# === 自動生成ファイル / DO NOT EDIT ===")
[void]$sb.AppendLine("# マスター: hotel-database-full.csv")
[void]$sb.AppendLine("# 生成:     scripts/build-hotels.ps1")
[void]$sb.AppendLine("# 区分・カテゴリ・特徴・価格を変えるときはCSVを編集して本スクリプトで再生成すること。")
[void]$sb.AppendLine("# policy: normal | name-only（名称・カテゴリのみ掲載）")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("areas:")

foreach ($a in $areas) {
  if ($a.id -ne "a") { [void]$sb.AppendLine("") }
  $rows = @($csv | Where-Object { $_."エリア記号" -eq $a.tag })
  [void]$sb.AppendLine(("  - id: {0}" -f $a.id))
  [void]$sb.AppendLine(("    tag: ""{0}""" -f $a.tag))
  [void]$sb.AppendLine(("    name: ""{0}""" -f $a.name))
  [void]$sb.AppendLine(("    name_en: ""{0}""" -f $a.name_en))
  [void]$sb.AppendLine(("    name_zh: ""{0}""" -f $a.name_zh))
  [void]$sb.AppendLine(("    group: ""{0}""" -f $a.group))
  [void]$sb.AppendLine(("    count: {0}" -f $rows.Count))
  [void]$sb.AppendLine(("    note: ""{0}""" -f $a.note))
  [void]$sb.AppendLine(("    note_en: ""{0}""" -f $a.note_en))
  [void]$sb.AppendLine(("    note_zh: ""{0}""" -f $a.note_zh))
  [void]$sb.AppendLine("    hotels:")
  foreach ($r in $rows) {
    $pol = Convert-Policy $r
    $ip  = "true"
    if ($pol -eq "name-only") { $ip = "false" }
    $dispName = ($r."表示名").Trim()
    if (-not $dispName) { $dispName = $r."施設名" }
    $nameEn = ($r."英語表記").Trim()
    if (-not $nameEn) { $nameEn = $dispName }
    $featEn = ""
    if ($r.slug -and $featureEn.ContainsKey($r.slug)) { $featEn = $featureEn[$r.slug] }
    $nameZhV = ""
    if ($r.slug -and $nameZh.ContainsKey($r.slug)) { $nameZhV = $nameZh[$r.slug] }
    if (-not $nameZhV) { $nameZhV = $dispName }
    $featZh = ""
    if ($r.slug -and $featureZh.ContainsKey($r.slug)) { $featZh = $featureZh[$r.slug] }
    [void]$sb.AppendLine(("      - name: ""{0}""" -f $dispName))
    [void]$sb.AppendLine(("        name_en: ""{0}""" -f $nameEn))
    [void]$sb.AppendLine(("        name_zh: ""{0}""" -f $nameZhV))
    [void]$sb.AppendLine(("        category: ""{0}""" -f (Convert-Category $r)))
    [void]$sb.AppendLine(("        price_guide: ""{0}""" -f (Convert-Price $r)))
    [void]$sb.AppendLine(("        feature: ""{0}""" -f $r."特徴ラベル"))
    [void]$sb.AppendLine(("        feature_en: ""{0}""" -f $featEn))
    [void]$sb.AppendLine(("        feature_zh: ""{0}""" -f $featZh))
    [void]$sb.AppendLine(("        policy: {0}" -f $pol))
    [void]$sb.AppendLine(("        individual_page: {0}" -f $ip))
    if ($pol -ne "name-only") {
      [void]$sb.AppendLine(("        slug: ""{0}""" -f $r.slug))
    }
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), $utf8NoBom)
Write-Output "生成完了: $outPath"
Write-Output ("エリア数: {0} / ホテル総数: {1}" -f $areas.Count, $csv.Count)
