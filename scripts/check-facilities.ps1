<#
.SYNOPSIS
  共有施設レジストリ（facility-database.csv）の保守チェック／逆引きツール。

.DESCRIPTION
  施設が閉店・改装・開店したとき、「どのホテル・記事が参照しているか」を一発で洗い出す。
  ホテル側の施設リンク列（館内店舗ID/最寄コンビニID/最寄ドラッグID/最寄スーパーID）を
  正（authoritative）として逆引きし、補助的に記事本文の店名出現もスキャンする。

.PARAMETER Facility
  施設ID（例 hilton-lawson-24h）または 店名/運営の部分一致。
  指定すると、その施設を参照しているホテル（リンク列）と記事（本文）を一覧する。

.PARAMETER StaleMonths
  last_verified がこの月数より古い施設を「要再確認」として警告（既定6）。

.EXAMPLE
  powershell -File scripts/check-facilities.ps1
  powershell -File scripts/check-facilities.ps1 -Facility hilton-lawson-24h
  powershell -File scripts/check-facilities.ps1 -Facility ローソン
#>
param(
  [string]$Facility = "",
  [int]$StaleMonths = 6
)
$ErrorActionPreference = "Stop"
$root     = Split-Path $PSScriptRoot -Parent
$facCsv   = Join-Path $root "facility-database.csv"
$hotelCsv = Join-Path $root "hotel-database-full.csv"
$contentDir = Join-Path $root "content\travel-guide\hotels"

$facs   = Import-Csv $facCsv   -Encoding UTF8
$hotels = Import-Csv $hotelCsv -Encoding UTF8
$linkCols = @('館内店舗ID','最寄コンビニID','最寄ドラッグID','最寄スーパーID')

# 施設辞書
$facById = @{}
foreach ($f in $facs) { if ($f.id.Trim()) { $facById[$f.id.Trim()] = $f } }

# 逆引き: facilityId -> @(slug...)
$refByFac = @{}
foreach ($h in $hotels) {
  $slug = ($h.slug).Trim(); if (-not $slug) { continue }
  foreach ($c in $linkCols) {
    foreach ($id in (($h.$c) -split ';' | Where-Object { $_.Trim() })) {
      $id = $id.Trim()
      if (-not $refByFac.ContainsKey($id)) { $refByFac[$id] = @() }
      $refByFac[$id] += ("{0} [{1}]" -f $slug, $c)
    }
  }
}

# 記事本文をメモリへ（slug -> text）
$mdText = @{}
Get-ChildItem "$contentDir\*.md" | ForEach-Object {
  $mdText[$_.Name] = [System.IO.File]::ReadAllText($_.FullName)
}
function Find-Mentions([string]$needle) {
  $hit = @()
  if (-not $needle) { return $hit }
  foreach ($k in $mdText.Keys) { if ($mdText[$k].Contains($needle)) { $hit += $k } }
  return ($hit | Sort-Object)
}

function Show-Facility($f) {
  $id = $f.id.Trim()
  Write-Host ("● {0}  [{1}] status={2}" -f $id, $f.type, $f.status) -ForegroundColor Cyan
  Write-Host ("   名称: {0}" -f $f.name)
  if ($f.hours.Trim())         { Write-Host ("   時間: {0}" -f $f.hours) }
  if ($f.last_verified.Trim()) { Write-Host ("   最終確認: {0}" -f $f.last_verified) }
  # リンク列での参照（正）
  $refs = @()
  if ($refByFac.ContainsKey($id)) { $refs = $refByFac[$id] }
  if ($refs.Count -gt 0) { Write-Host ("   リンク参照ホテル({0}): {1}" -f $refs.Count, ($refs -join ', ')) -ForegroundColor Green }
  else { Write-Host "   リンク参照ホテル: なし" -ForegroundColor DarkYellow }
  # 本文での店名出現（補助）
  $mNameJp = Find-Mentions $f.name.Trim()
  if ($mNameJp.Count -gt 0) { Write-Host ("   本文に正式名称あり: {0}" -f ($mNameJp -join ', ')) }
  $mEn = Find-Mentions $f.name_en.Trim()
  if ($mEn.Count -gt 0) { Write-Host ("   EN本文に英名あり: {0}" -f ($mEn -join ', ')) }
  Write-Host ""
}

Write-Host "==================================================================="
if ($Facility) {
  # --- 逆引きモード ---
  $matches = @()
  if ($facById.ContainsKey($Facility)) { $matches += $facById[$Facility] }
  else {
    foreach ($f in $facs) {
      if ($f.name -like "*$Facility*" -or $f.operator -like "*$Facility*" -or $f.id -like "*$Facility*") { $matches += $f }
    }
  }
  if ($matches.Count -eq 0) { Write-Host "該当施設なし: $Facility" -ForegroundColor Red; return }
  Write-Host ("逆引き: '{0}' に一致 {1} 件" -f $Facility, $matches.Count)
  Write-Host "==================================================================="
  foreach ($f in $matches) { Show-Facility $f }
  # 運営での広域ヒント（総称が複数店舗に分かれている注意喚起）
  $op = $matches[0].operator.Trim()
  if ($op) {
    $opHits = Find-Mentions $op
    Write-Host ("補足: 運営「{0}」を含む記事は計{1}本（別店舗の可能性あり。正確な対象はリンク列で判断）:" -f $op, $opHits.Count) -ForegroundColor DarkGray
    Write-Host ("   {0}" -f ($opHits -join ', ')) -ForegroundColor DarkGray
  }
  return
}

# --- 監査モード（引数なし） ---
$issues = 0

# 1) 壊れたリンク（リンク列のIDがレジストリに無い）
Write-Host "[1] 壊れたリンク（存在しない施設IDを参照）"
$broken = @()
foreach ($id in $refByFac.Keys) { if (-not $facById.ContainsKey($id)) { $broken += ("{0} ← {1}" -f $id, ($refByFac[$id] -join ', ')) } }
if ($broken.Count -eq 0) { Write-Host "   OK（なし）" -ForegroundColor Green } else { $broken | ForEach-Object { Write-Host "   ✗ $_" -ForegroundColor Red }; $issues += $broken.Count }

# 2) 閉店なのに参照が残っている
Write-Host "[2] status=closed なのに参照が残存"
$closedBad = @()
foreach ($f in $facs) {
  if ($f.status.Trim() -eq 'closed') {
    $id = $f.id.Trim()
    $linked = $refByFac.ContainsKey($id)
    $prose  = (Find-Mentions $f.name.Trim()).Count -gt 0
    if ($linked -or $prose) { $closedBad += ("{0}（{1}）: リンク={2} 本文={3}" -f $id, $f.name, $linked, $prose) }
  }
}
if ($closedBad.Count -eq 0) { Write-Host "   OK（なし）" -ForegroundColor Green } else { $closedBad | ForEach-Object { Write-Host "   ⚠ $_" -ForegroundColor Yellow }; $issues += $closedBad.Count }

# 3) last_verified が古い
Write-Host ("[3] 最終確認が{0}か月より古い施設" -f $StaleMonths)
$limit = (Get-Date).AddMonths(-$StaleMonths)
$stale = @()
foreach ($f in $facs) {
  $raw = ($f.last_verified).Trim()
  try {
    $d = [datetime]::Parse($raw)
    if ($d -lt $limit) { $stale += ("{0}（{1}）" -f $f.id, $raw) }
  } catch {
    $stale += ("{0}（日付不明: {1}）" -f $f.id, $raw)
  }
}
if ($stale.Count -eq 0) { Write-Host "   OK（なし）" -ForegroundColor Green } else { $stale | ForEach-Object { Write-Host "   ⚠ $_" -ForegroundColor Yellow }; $issues += $stale.Count }

# 4) どのホテルからもリンクされていない施設（情報。地域POIは大半が未リンクで正常）
Write-Host "[4] 未リンク施設（情報・地域参照POIは未リンクが通常）"
$orphan = @()
foreach ($f in $facs) { $id = $f.id.Trim(); if ($f.status.Trim() -ne 'closed' -and -not $refByFac.ContainsKey($id)) { $orphan += $id } }
Write-Host ("   未リンク {0} 件（うちホテル併設候補はレポート参照）" -f $orphan.Count) -ForegroundColor DarkGray

Write-Host "==================================================================="
Write-Host ("施設 {0} 件 / 紐付け列を持つホテル {1} 軒 / 要対応 {2} 件" -f $facs.Count, (($hotels | Where-Object { $_.'館内店舗ID' -or $_.'最寄コンビニID' -or $_.'最寄ドラッグID' -or $_.'最寄スーパーID' }).Count), $issues)
