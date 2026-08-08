# 座標エディタ (tools/facility-coord-editor.html) の出力を facility-database.csv に取り込む。
#
# 使い方:
#   1. エディタで修正 →「出力を見る」→「コピー」
#   2. tools/coord-edits.csv に貼り付けて保存（UTF-8）
#   3. powershell -File scripts\apply-coord-edits.ps1
#   4. powershell -File scripts\build-all.ps1     ← 地図に反映
#
#   -WhatIf を付けると書き換えずに内容だけ表示する。
[CmdletBinding(SupportsShouldProcess=$true)]
param(
  [string]$EditsPath
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName Microsoft.VisualBasic

$repo = Split-Path -Parent $PSScriptRoot
$csvPath = Join-Path $repo 'facility-database.csv'
if (-not $EditsPath) { $EditsPath = Join-Path $repo 'tools\coord-edits.csv' }
if (-not (Test-Path $EditsPath)) { throw "編集ファイルが見つかりません: $EditsPath`n（エディタの出力を貼り付けて保存してください）" }

# ---- 編集内容を読む（status=moved のみ反映。ok は「現状で正しい」の記録なので変更しない）----
# PS5.1のImport-CsvはBOM無しUTF-8をCP932と誤読するため、明示的にUTF-8で読む。
# （idはASCIIなので突合自体は壊れないが、店名の表示が化けるのを防ぐ）
$editRows = (Get-Content -Path $EditsPath -Raw -Encoding UTF8) | ConvertFrom-Csv
$edits = @{}; $okCount = 0
foreach ($e in $editRows) {
  if (-not $e.id) { continue }
  if ($e.status -eq 'ok') { $okCount++; continue }
  if ($e.status -ne 'moved') { continue }
  $lat = 0.0; $lng = 0.0
  if (-not [double]::TryParse($e.lat, [ref]$lat) -or -not [double]::TryParse($e.lng, [ref]$lng)) {
    throw "座標が数値として読めません: id=$($e.id) lat=$($e.lat) lng=$($e.lng)"
  }
  if ($lat -lt 35.5 -or $lat -gt 35.8 -or $lng -lt 139.7 -or $lng -gt 140.1) {
    throw "座標が浦安周辺の範囲外です: id=$($e.id) $lat,$lng"
  }
  $edits[$e.id] = @{ lat = $e.lat; lng = $e.lng; name = $e.name }
}
Write-Output "反映対象: $($edits.Count) 件（『現状で正しい』$okCount 件は変更しません）"
if ($edits.Count -eq 0) { Write-Output '反映するものがありません。'; return }

# ---- CSVを読む ----
$p = New-Object Microsoft.VisualBasic.FileIO.TextFieldParser($csvPath, [System.Text.Encoding]::UTF8)
$p.TextFieldType = [Microsoft.VisualBasic.FileIO.FieldType]::Delimited
$p.SetDelimiters(',')
$hdr = $p.ReadFields(); $I = @{}; for ($k=0; $k -lt $hdr.Count; $k++) { $I[$hdr[$k]] = $k }
$all = @(); $all += ,$hdr
while (-not $p.EndOfData) { $all += ,($p.ReadFields()) }
$p.Close()

function Dist($a,$b,$c,$d){ $R=6371000.0; $q=[Math]::PI/180
  $x=[Math]::Sin(($c-$a)*$q/2)*[Math]::Sin(($c-$a)*$q/2)+[Math]::Cos($a*$q)*[Math]::Cos($c*$q)*[Math]::Sin(($d-$b)*$q/2)*[Math]::Sin(($d-$b)*$q/2)
  return $R*2*[Math]::Atan2([Math]::Sqrt($x),[Math]::Sqrt(1-$x)) }

$log = @(); $seen = @{}
for ($r=1; $r -lt $all.Count; $r++) {
  $id = $all[$r][$I['id']]
  if (-not $edits.ContainsKey($id)) { continue }
  $t = $edits[$id]; $seen[$id] = $true
  $shift = [Math]::Round((Dist ([double]$all[$r][$I['lat']]) ([double]$all[$r][$I['lng']]) ([double]$t.lat) ([double]$t.lng)),1)
  $log += [pscustomobject]@{ id=$id; name=$all[$r][$I['name']]
    old="$($all[$r][$I['lat']]),$($all[$r][$I['lng']])"; new="$($t.lat),$($t.lng)"; shift_m=$shift }
  $all[$r][$I['lat']] = $t.lat
  $all[$r][$I['lng']] = $t.lng
}
$miss = @($edits.Keys | Where-Object { -not $seen.ContainsKey($_) })
if ($miss.Count -gt 0) { throw ("CSVに存在しないID: " + ($miss -join ', ')) }

$log | Sort-Object { -[double]$_.shift_m } | Format-Table -AutoSize | Out-String -Width 220

if ($PSCmdlet.ShouldProcess($csvPath, "座標 $($log.Count) 件を更新")) {
  function Q([string]$v){ if ($null -eq $v) { return '' }
    if ($v -match '[",\r\n]') { return '"' + $v.Replace('"','""') + '"' }; return $v }
  $sb = New-Object System.Text.StringBuilder
  foreach ($row in $all) { [void]$sb.Append((($row | ForEach-Object { Q $_ }) -join ',')); [void]$sb.Append("`r`n") }
  [System.IO.File]::WriteAllText($csvPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($true)))
  Write-Output "更新しました: $csvPath（$($log.Count) 件）"
  Write-Output "次に: powershell -File scripts\build-all.ps1"
}
