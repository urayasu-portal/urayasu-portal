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

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# === 自動生成ファイル / DO NOT EDIT ===")
[void]$sb.AppendLine("# マスター: hotel-database-full.csv")
[void]$sb.AppendLine("# 生成:     scripts/build-hotels-map.ps1")
[void]$sb.AppendLine("# 座標・フラグ・最低価格を変えるときはCSVを編集して本スクリプトで再生成すること。")
[void]$sb.AppendLine("# flags: shuttle=TDRシャトル, bath=大浴場, convenience=館内コンビニ,")
[void]$sb.AppendLine("#         limousine=空港リムジン, station=駅直結/徒歩1分, kitchen=ミニキッチン")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("hotels:")

$count = 0
foreach ($r in $csv) {
  $slug = ($r.slug).Trim()
  if (-not $slug) { continue }                 # slug無し（name-only等）はスキップ
  $lat = ($r."緯度").Trim()
  $lng = ($r."経度").Trim()
  if (-not $lat -or -not $lng) { continue }    # 座標無しは地図対象外

  $pm = 0
  if (($r."最低価格").Trim() -match '^[0-9]+$') { $pm = [int]($r."最低価格").Trim() }

  $flags = ""
  $fraw = ($r."機能フラグ").Trim()
  if ($fraw) { $flags = (($fraw -split ';' | Where-Object { $_ }) -join ', ') }

  [void]$sb.AppendLine("  - slug: ""$slug""")
  [void]$sb.AppendLine("    lat: $lat")
  [void]$sb.AppendLine("    lng: $lng")
  [void]$sb.AppendLine("    price_min: $pm")
  [void]$sb.AppendLine("    flags: [$flags]")
  [void]$sb.AppendLine("    name: ""$($r.'施設名')""")
  [void]$sb.AppendLine("    address: ""$($r.'住所')""")
  $count++
}

# BOMなしUTF-8で書き出し（HugoのYAMLパーサ対策）
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), $utf8NoBom)

Write-Output "生成完了: $outPath"
Write-Output "出力ホテル数: $count / CSV総行数: $($csv.Count)"
