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
$areas = @(
  [ordered]@{ id="a"; tag="A"; name="舞浜エリア";   note="ディズニーホテル・オフィシャル集中。パーク最至近。" }
  [ordered]@{ id="b"; tag="B"; name="千鳥エリア";   note="マイステイズ舞浜はTDS徒歩6分・最安値クラス。" }
  [ordered]@{ id="c"; tag="C"; name="新浦安エリア"; note="パートナーホテル集中。空港リムジンも便利。" }
  [ordered]@{ id="d"; tag="D"; name="浦安駅エリア"; note="東西線直通で都心1本。パークへはバス25〜30分。" }
  [ordered]@{ id="e"; tag="E"; name="浦安近郊";   note="葛西・市川・妙典など隣接エリア。電車で浦安・舞浜へ。" }
)

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
  [void]$sb.AppendLine(("    count: {0}" -f $rows.Count))
  [void]$sb.AppendLine(("    note: ""{0}""" -f $a.note))
  [void]$sb.AppendLine("    hotels:")
  foreach ($r in $rows) {
    $pol = Convert-Policy $r
    $ip  = "true"
    if ($pol -eq "name-only") { $ip = "false" }
    $dispName = ($r."表示名").Trim()
    if (-not $dispName) { $dispName = $r."施設名" }
    [void]$sb.AppendLine(("      - name: ""{0}""" -f $dispName))
    [void]$sb.AppendLine(("        category: ""{0}""" -f (Convert-Category $r)))
    [void]$sb.AppendLine(("        price_guide: ""{0}""" -f (Convert-Price $r)))
    [void]$sb.AppendLine(("        feature: ""{0}""" -f $r."特徴ラベル"))
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
