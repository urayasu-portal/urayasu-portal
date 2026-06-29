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
  [ordered]@{ id="a"; tag="A"; group="リゾート";   name="舞浜エリア";   note="ディズニーホテル・オフィシャル集中。パーク最至近。"; name_en="Maihama";       note_en="Disney & Official hotels, closest to the parks." }
  [ordered]@{ id="b"; tag="B"; group="リゾート";   name="千鳥エリア";   note="マイステイズ舞浜はTDS徒歩6分・最安値クラス。"; name_en="Chidori";       note_en="MYSTAYS Maihama is a 6-min walk to TDS, best-value class." }
  [ordered]@{ id="c"; tag="C"; group="ベイサイド"; name="新町エリア";   note="日の出・明海のパートナーホテル集中。無料シャトル・空港リムジンも便利。"; name_en="Shinmachi";     note_en="Partner hotels in Hinode/Akemi. Free shuttles & airport limousines." }
  [ordered]@{ id="d"; tag="D"; group="ベイサイド"; name="新浦安エリア"; note="新浦安駅周辺（美浜・今川・東野）。京葉線で舞浜まで2駅。"; name_en="Shin-Urayasu";  note_en="Around Shin-Urayasu Stn. Two stops to Maihama on the Keiyo Line." }
  [ordered]@{ id="e"; tag="E"; group="リバーサイド"; name="元町エリア";   note="富士見など旧市街南側。旧江戸川沿いの落ち着いた住宅エリア。"; name_en="Motomachi";     note_en="Old-town south side along the Edogawa. Quiet residential area." }
  [ordered]@{ id="f"; tag="F"; group="リバーサイド"; name="浦安駅エリア"; note="東西線直通で都心1本。パークへはバス25〜30分。"; name_en="Urayasu Stn";   note_en="Direct to central Tokyo on the Tozai Line. 25-30 min by bus to the parks." }
  [ordered]@{ id="g"; tag="G"; group="浦安近郊";   name="浦安近郊";   note="葛西・市川・妙典など隣接エリア。電車で浦安・舞浜へ。"; name_en="Near Urayasu";  note_en="Adjacent Kasai/Ichikawa/Myoden. Train to Urayasu & Maihama." }
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
  [void]$sb.AppendLine(("    group: ""{0}""" -f $a.group))
  [void]$sb.AppendLine(("    count: {0}" -f $rows.Count))
  [void]$sb.AppendLine(("    note: ""{0}""" -f $a.note))
  [void]$sb.AppendLine(("    note_en: ""{0}""" -f $a.note_en))
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
    [void]$sb.AppendLine(("      - name: ""{0}""" -f $dispName))
    [void]$sb.AppendLine(("        name_en: ""{0}""" -f $nameEn))
    [void]$sb.AppendLine(("        category: ""{0}""" -f (Convert-Category $r)))
    [void]$sb.AppendLine(("        price_guide: ""{0}""" -f (Convert-Price $r)))
    [void]$sb.AppendLine(("        feature: ""{0}""" -f $r."特徴ラベル"))
    [void]$sb.AppendLine(("        feature_en: ""{0}""" -f $featEn))
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
