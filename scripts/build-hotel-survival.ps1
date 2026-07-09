<#
.SYNOPSIS
  ホテル別「生活サバイバル情報」データ data/hotel_survival.yaml を生成する。

.DESCRIPTION
  hotel-database-full.csv のリンク列（館内店舗ID/最寄コンビニ/ドラッグ/スーパー/コインランドリー/ATM）と
  facility-database.csv を突き合わせ、各ホテルの「最寄りの生活施設」を解決済みで書き出す。
  Hugo側(shortcodes/hotel-survival.html)は本ファイルを slug で引くだけで描画できる（結合ロジックは持たない）。

  役割ごとの解決:
    conbini    : 館内店舗ID にコンビニがあれば館内優先（in_building）、無ければ最寄コンビニID
    drugstore  : 最寄ドラッグID
    supermarket: 最寄スーパーID
    laundry    : 最寄コインランドリーID が "館内" なら館内フラグ、施設IDなら最寄施設
    atm        : 最寄ATMID（atm_intl=1 の海外カード対応店）
  徒歩分 = ceil(距離m / 80)（成人の平均徒歩速度 約80m/分）。館内は 0。
  エリアG(市外)・座標なしのホテルは対象外（施設DB=浦安市内の範囲外）。

.EXAMPLE
  powershell -File scripts/build-hotel-survival.ps1
#>
$ErrorActionPreference = "Stop"
$root     = Split-Path $PSScriptRoot -Parent
$hotelCsv = Join-Path $root "hotel-database-full.csv"
$facCsv   = Join-Path $root "facility-database.csv"
$outPath  = Join-Path $root "data\hotel_survival.yaml"

$hotels = Import-Csv $hotelCsv -Encoding UTF8
$facs   = Import-Csv $facCsv   -Encoding UTF8
. (Join-Path $PSScriptRoot "hours-i18n.ps1")
$facById = @{}
foreach ($f in $facs) { if (($f.id).Trim()) { $facById[($f.id).Trim()] = $f } }

function Q([string]$s) { '"' + (($s) -replace '\\','\\' -replace '"','\"') + '"' }
function Dist($la1,$lo1,$la2,$lo2){ $R=6371000.0;$p=[Math]::PI/180
  $a=[Math]::Sin(($la2-$la1)*$p/2)*[Math]::Sin(($la2-$la1)*$p/2)+[Math]::Cos($la1*$p)*[Math]::Cos($la2*$p)*[Math]::Sin(($lo2-$lo1)*$p/2)*[Math]::Sin(($lo2-$lo1)*$p/2)
  return $R*2*[Math]::Atan2([Math]::Sqrt($a),[Math]::Sqrt(1-$a)) }

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# === 自動生成ファイル / DO NOT EDIT ===")
[void]$sb.AppendLine("# マスター: hotel-database-full.csv + facility-database.csv")
[void]$sb.AppendLine("# 生成:     scripts/build-hotel-survival.ps1")
[void]$sb.AppendLine("# ホテルの最寄り施設リンクや施設情報を変えたら再生成すること。")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("hotels:")

$nHotel = 0; $nItem = 0
foreach ($h in $hotels) {
  if ($h."掲載区分" -eq "名称・カテゴリのみ掲載") { continue }
  if ($h."エリア記号" -eq "G") { continue }
  $hlat = ($h."緯度").Trim(); $hlng = ($h."経度").Trim()
  if ($hlat -notmatch '^-?[0-9.]+$' -or $hlng -notmatch '^-?[0-9.]+$') { continue }
  $hlatD = [double]$hlat; $hlngD = [double]$hlng
  $slug = ($h.slug).Trim()
  if (-not $slug) { continue }

  # 館内コンビニ判定
  $kanaiIds = @()
  if (($h."館内店舗ID").Trim()) { $kanaiIds = ($h."館内店舗ID" -split ';' | ForEach-Object { $_.Trim() }) }
  $kanaiConbini = $null
  foreach ($kid in $kanaiIds) { if ($facById.ContainsKey($kid) -and $facById[$kid].type -eq 'conbini') { $kanaiConbini = $facById[$kid]; break } }

  # 解決対象: role, facilityId, forceInBuilding
  $plan = @()
  if ($kanaiConbini) { $plan += @{ role='conbini'; fac=$kanaiConbini; inb=$true } }
  elseif (($h."最寄コンビニID").Trim()) { $plan += @{ role='conbini'; fac=$facById[($h."最寄コンビニID").Trim()]; inb=$false } }
  if (($h."最寄ドラッグID").Trim())   { $plan += @{ role='drugstore';   fac=$facById[($h."最寄ドラッグID").Trim()]; inb=$false } }
  if (($h."最寄スーパーID").Trim())   { $plan += @{ role='supermarket'; fac=$facById[($h."最寄スーパーID").Trim()]; inb=$false } }
  $launVal = ($h."最寄コインランドリーID").Trim()
  if ($launVal -eq '館内') { $plan += @{ role='laundry'; fac=$null; inb=$true } }
  elseif ($launVal) { $plan += @{ role='laundry'; fac=$facById[$launVal]; inb=$false } }
  if (($h."最寄ATMID").Trim())        { $plan += @{ role='atm'; fac=$facById[($h."最寄ATMID").Trim()]; inb=$false } }

  $items = @()
  foreach ($p in $plan) {
    if ($p.role -eq 'laundry' -and $p.inb) {
      $items += @{ role='laundry'; in_building=$true; name=''; name_en=''; hours=''; is_24h=$false; atm_intl=''; tax_free=$false; walk_min=0; lat=''; lng=''; address=''; url='' }
      continue
    }
    $f = $p.fac
    if ($null -eq $f) { continue }
    $wm = 0
    if (-not $p.inb) {
      $d = Dist $hlatD $hlngD ([double]$f.lat) ([double]$f.lng)
      $wm = [int][Math]::Max(1, [Math]::Ceiling($d/80.0))
    }
    $items += @{
      role=$p.role; in_building=$p.inb
      name=($f.name).Trim(); name_en=($f.name_en).Trim(); hours=($f.hours).Trim()
      is_24h=(($f.is_24h).Trim() -eq '1'); atm_intl=($f.atm_intl).Trim()
      tax_free=(($f.tax_free).Trim() -eq '1'); walk_min=$wm
      lat=($f.lat).Trim(); lng=($f.lng).Trim(); address=($f.address).Trim(); url=($f.official_url).Trim()
    }
  }
  if ($items.Count -eq 0) { continue }

  [void]$sb.AppendLine(("  - slug: {0}" -f (Q $slug)))
  [void]$sb.AppendLine("    items:")
  foreach ($it in $items) {
    [void]$sb.AppendLine(("      - role: {0}" -f (Q $it.role)))
    [void]$sb.AppendLine(("        in_building: {0}" -f ($(if($it.in_building){'true'}else{'false'}))))
    if ($it.name)    { [void]$sb.AppendLine(("        name: {0}" -f (Q $it.name))) }
    if ($it.name_en) { [void]$sb.AppendLine(("        name_en: {0}" -f (Q $it.name_en))) }
    if ($it.hours)   {
      [void]$sb.AppendLine(("        hours: {0}" -f (Q $it.hours)))
      [void]$sb.AppendLine(("        hours_en: {0}" -f (Q (Get-HoursI18n $it.hours 'en'))))
      [void]$sb.AppendLine(("        hours_zh: {0}" -f (Q (Get-HoursI18n $it.hours 'zh'))))
      [void]$sb.AppendLine(("        hours_ko: {0}" -f (Q (Get-HoursI18n $it.hours 'ko'))))
      [void]$sb.AppendLine(("        hours_zhtw: {0}" -f (Q (Get-HoursI18n $it.hours 'zh-tw'))))
    }
    if ($it.is_24h)  { [void]$sb.AppendLine("        is_24h: true") }
    if ($it.atm_intl){ [void]$sb.AppendLine(("        atm_intl: {0}" -f (Q $it.atm_intl))) }
    if ($it.tax_free){ [void]$sb.AppendLine("        tax_free: true") }
    [void]$sb.AppendLine(("        walk_min: {0}" -f $it.walk_min))
    if ($it.lat -match '^-?[0-9.]+$') { [void]$sb.AppendLine(("        lat: {0}" -f $it.lat)) }
    if ($it.lng -match '^-?[0-9.]+$') { [void]$sb.AppendLine(("        lng: {0}" -f $it.lng)) }
    if ($it.address) { [void]$sb.AppendLine(("        address: {0}" -f (Q $it.address))) }
    if ($it.url)     { [void]$sb.AppendLine(("        url: {0}" -f (Q $it.url))) }
    $nItem++
  }
  $nHotel++
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), $utf8NoBom)
Write-Output "生成完了: $outPath"
Write-Output ("対象ホテル: {0} 軒 / 施設アイテム: {1} 件" -f $nHotel, $nItem)
