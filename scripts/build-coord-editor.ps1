# 座標エディタ (tools/facility-coord-editor.html) が読み込むデータを生成する。
#   facility-database.csv  →  tools/facility-data.js
# CSVを更新したらこのスクリプトを再実行するとエディタに反映される。
# ※ tools/ 配下はHugoの公開対象外なのでサイトには出ない（社内ツール扱い）。
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName Microsoft.VisualBasic

$repo = Split-Path -Parent $PSScriptRoot
$csvPath = Join-Path $repo 'facility-database.csv'
$outPath = Join-Path $repo 'tools\facility-data.js'

# 座標を検証済みのID。エディタの「未検証のみ」フィルタで使う。
# 追加するときは tools/coord-edits.csv の id 列（moved/ok の両方）を貼り足す。
#
# ①2026-08-03 手作業（座標エディタで1件ずつ地図照合）
$VERIFIED_MANUAL = @(
  'hilton-lawson-24h','hilton-lawson-s','newdays-maihama','atre-shin-urayasu','royal-park-lawson',
  'poi-001','poi-003','poi-006','poi-009','poi-010','poi-011','poi-013','poi-015','poi-016','poi-017',
  'poi-018','poi-023','poi-025','poi-031','poi-033','poi-035','poi-036','poi-037','poi-038','poi-039',
  'poi-040','poi-042','poi-046','poi-048','poi-050','poi-051','poi-052','poi-053','poi-054','poi-055',
  'poi-056','poi-057','poi-058','poi-059','poi-060','poi-064','poi-065','poi-067','poi-068','poi-069',
  'poi-071','poi-072','poi-076','poi-080','poi-081','poi-085','poi-086','poi-088','poi-089','poi-090',
  'poi-091','poi-092','poi-094','poi-095','poi-096','poi-097','poi-098','poi-100','poi-101','poi-102',
  'poi-103','poi-109','poi-110','poi-111','poi-112','poi-113','poi-114','poi-115','poi-116','poi-118',
  'poi-119','poi-121','poi-123','poi-125','poi-127','poi-130','poi-133','poi-134','poi-136','poi-137',
  'poi-138','poi-139','poi-140','poi-142','poi-143','poi-145','poi-146','poi-147','poi-149','poi-150',
  'poi-153','poi-154','poi-155','poi-156','poi-161','poi-165','poi-166','poi-167','poi-168','poi-169',
  'poi-171','poi-173','poi-175','poi-177','poi-178','poi-181','poi-182','poi-185','poi-188','poi-189',
  'poi-198','poi-199','poi-203','seims-maihama','daiso-ekimae','seria-seiyu','watts-maruetsu',
  'watts-higashino','post-urayasu','post-ekimae','post-bokai','post-nekomi2','uniqlo-atre',
  'torikizoku-shinurayasu','uotami-ekimae','nojima-seiyu','seria-forte'
)
# ②2026-08-02 OSM照合で補正/検証済み
$VERIFIED = $VERIFIED_MANUAL + @(
  'seven-eleven-urayasu-maihama','mona-shin-urayasu','hoshino-lawson','emion-familymart',
  'daily-yamazaki-chidori','seiyu-urayasu-ekimae','poi-002','poi-004','poi-005','poi-008','poi-014',
  'poi-019','poi-024','poi-026','poi-027','poi-028','poi-029','poi-030','poi-032','poi-034','poi-041',
  'poi-045','poi-049','poi-061','poi-063','poi-073','poi-074','poi-075','poi-077','poi-078','poi-079',
  'poi-082','poi-083','poi-084','poi-087','poi-093','poi-099','poi-105','poi-106','poi-107','poi-108',
  'poi-117','poi-122','poi-124','poi-126','poi-128','poi-129','poi-131','poi-132','poi-135','poi-141',
  'poi-144','poi-148','poi-151','poi-152','poi-157','poi-158','poi-159','poi-160','poi-162','poi-163',
  'poi-164','poi-170','poi-172','poi-174','poi-176','poi-179','poi-180','poi-183','poi-184','poi-186',
  'poi-187','poi-190','poi-191','poi-192','poi-193','poi-194','poi-195','poi-196','poi-197','poi-200',
  'poi-201','poi-202','poi-204','daiso-aeon','daiso-newcoast','daiso-ikspiari','seria-mona',
  'post-tomioka','gu-mona','shimamura-newcoast','mekiki-mona','nojima-newcoast','yamada-aeon',
  'ksdenki-hinode',
  # 座標変更は不要だったが、OSMの実店舗と一致することを確認済み（ズレ10m未満）
  'poi-012','poi-031','poi-044','poi-047','poi-104'
)

$p = New-Object Microsoft.VisualBasic.FileIO.TextFieldParser($csvPath, [System.Text.Encoding]::UTF8)
$p.TextFieldType = [Microsoft.VisualBasic.FileIO.FieldType]::Delimited
$p.SetDelimiters(',')
$h = $p.ReadFields(); $I = @{}; for ($k=0; $k -lt $h.Count; $k++) { $I[$h[$k]] = $k }
$rows = @()
while (-not $p.EndOfData) {
  $f = $p.ReadFields()
  if ($f[$I['status']] -ne 'open') { continue }
  if (-not $f[$I['lat']] -or -not $f[$I['lng']]) { continue }
  $rows += [pscustomobject]@{
    id      = $f[$I['id']]
    type    = $f[$I['type']]
    name    = $f[$I['name']]
    address = $f[$I['address']]
    hours   = $f[$I['hours']]
    url     = $f[$I['official_url']]
    lat     = [double]$f[$I['lat']]
    lng     = [double]$f[$I['lng']]
    ok      = [bool]($VERIFIED -contains $f[$I['id']])
  }
}
$p.Close()

$json = $rows | ConvertTo-Json -Depth 3 -Compress
$js = "/* DO NOT EDIT - scripts/build-coord-editor.ps1 が生成 */`r`nvar FACILITIES = $json;`r`n"
$dir = Split-Path -Parent $outPath
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
[System.IO.File]::WriteAllText($outPath, $js, (New-Object System.Text.UTF8Encoding($false)))

Write-Output "生成完了: $outPath"
Write-Output "  施設 $($rows.Count) 件 / 検証済み $(($rows | Where-Object ok).Count) 件 / 未検証 $(($rows | Where-Object { -not $_.ok }).Count) 件"
