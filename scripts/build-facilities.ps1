<#
.SYNOPSIS
  facility-database.csv（共有施設レジストリのマスター）から data/facilities.yaml を生成する。

.DESCRIPTION
  コンビニ・ドラッグストア・スーパー・商業施設など、複数のホテル記事から参照される
  「共有ランドマーク」と、追跡価値のある館内店舗を1か所で管理するマスター。
  店舗の閉店・開店時はこのCSVの status / hours / last_verified を更新し、
  scripts/check-facilities.ps1 で参照しているホテル・記事を洗い出す。
  （将来 type=medical を足せば医療機関記事のデータ源にも流用できる基底スキーマ）

  列：id / type / name / name_en / operator / status / hours / lat / lng /
      address / official_url / last_verified / note /
      open_early / open_late / is_24h（scripts/derive-inbound-flags.ps1 が hours から自動導出）/
      atm_intl（手動管理: 1=海外カード対応ATMあり / check=要確認 / 空=なし・不明）
#>
$ErrorActionPreference = "Stop"
$root    = Split-Path $PSScriptRoot -Parent
$csvPath = Join-Path $root "facility-database.csv"
$outPath = Join-Path $root "data\facilities.yaml"
if (-not (Test-Path $csvPath)) { throw "マスターCSVが見つかりません: $csvPath" }

$csv = Import-Csv $csvPath -Encoding UTF8
. (Join-Path $PSScriptRoot "hours-i18n.ps1")

function Q([string]$s) { '"' + (($s) -replace '"','\"') + '"' }

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# === 自動生成ファイル / DO NOT EDIT ===")
[void]$sb.AppendLine("# マスター: facility-database.csv  生成: scripts/build-facilities.ps1")
[void]$sb.AppendLine("# 施設の閉店/開店/時間変更はCSVを編集して再生成。参照記事は check-facilities.ps1 で確認。")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("facilities:")

$count = 0
foreach ($r in $csv) {
  $id = ($r.id).Trim()
  if (-not $id) { continue }
  [void]$sb.AppendLine("  - id: " + (Q $id))
  [void]$sb.AppendLine("    type: " + (Q ($r.type).Trim()))
  [void]$sb.AppendLine("    name: " + (Q ($r.name).Trim()))
  if (($r.name_en).Trim())     { [void]$sb.AppendLine("    name_en: " + (Q ($r.name_en).Trim())) }
  if (($r.operator).Trim())    { [void]$sb.AppendLine("    operator: " + (Q ($r.operator).Trim())) }
  [void]$sb.AppendLine("    status: " + (Q ($r.status).Trim()))
  $hj = ($r.hours).Trim()
  if ($hj) {
    [void]$sb.AppendLine("    hours: " + (Q $hj))
    [void]$sb.AppendLine("    hours_en: " + (Q (Get-HoursI18n $hj 'en')))
    [void]$sb.AppendLine("    hours_zh: " + (Q (Get-HoursI18n $hj 'zh')))
    [void]$sb.AppendLine("    hours_ko: " + (Q (Get-HoursI18n $hj 'ko')))
    [void]$sb.AppendLine("    hours_zhtw: " + (Q (Get-HoursI18n $hj 'zh-tw')))
  }
  if (($r.open_early).Trim() -eq '1') { [void]$sb.AppendLine("    open_early: true") }
  if (($r.open_late).Trim() -eq '1')  { [void]$sb.AppendLine("    open_late: true") }
  if (($r.is_24h).Trim() -eq '1')     { [void]$sb.AppendLine("    is_24h: true") }
  if (($r.atm_intl).Trim())    { [void]$sb.AppendLine("    atm_intl: " + (Q ($r.atm_intl).Trim())) }
  if (($r.baby_goods).Trim() -eq '1') { [void]$sb.AppendLine("    baby_goods: true") }
  if (($r.tax_free).Trim() -eq '1')   { [void]$sb.AppendLine("    tax_free: true") }
  if (($r.takkyubin).Trim() -eq '1')  { [void]$sb.AppendLine("    takkyubin: true") }
  if (($r.lat).Trim() -match '^-?[0-9.]+$') { [void]$sb.AppendLine("    lat: " + ($r.lat).Trim()) }
  if (($r.lng).Trim() -match '^-?[0-9.]+$') { [void]$sb.AppendLine("    lng: " + ($r.lng).Trim()) }
  if (($r.address).Trim())     { [void]$sb.AppendLine("    address: " + (Q ($r.address).Trim())) }
  if (($r.official_url).Trim()){ [void]$sb.AppendLine("    official_url: " + (Q ($r.official_url).Trim())) }
  if (($r.last_verified).Trim()){ [void]$sb.AppendLine("    last_verified: " + (Q ($r.last_verified).Trim())) }
  if (($r.note).Trim())        { [void]$sb.AppendLine("    note: " + (Q ($r.note).Trim())) }
  $count++
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), $utf8NoBom)
Write-Output "生成完了: $outPath"
Write-Output "施設数: $count / CSV総行数: $($csv.Count)"
