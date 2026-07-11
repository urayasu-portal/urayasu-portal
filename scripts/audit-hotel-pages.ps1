# Audit hotel pages (JA) against hotel-database-full.csv
# Checks: tel / address / IN-OUT / price / official URL / happy-entry / stale "yotei" dates
$ErrorActionPreference = "Stop"
$root = "C:\Users\kadoh\OneDrive\Desktop\urayasu-portal"
$csv = Import-Csv (Join-Path $root "hotel-database-full.csv") -Encoding UTF8

# Column names (Japanese headers) via variables to keep code ASCII-safe
$hdr = ($csv | Get-Member -MemberType NoteProperty).Name
$colTel   = $hdr | Where-Object { $_ -match '^電話番号$' }         # 電話番号
$colAddr  = $hdr | Where-Object { $_ -match '^住所$' }                     # 住所
$colInOut = $hdr | Where-Object { $_ -match 'チェックイン' } # チェックイン/アウト
$colPrice = $hdr | Where-Object { $_ -match '最低価格' }           # 最低価格
$colUrl   = $hdr | Where-Object { $_ -match '^公式サイトURL$' } # 公式サイトURL
$colCat   = $hdr | Where-Object { $_ -match '^カテゴリ$' }         # カテゴリ

$reDisney = [regex]::Unescape('ディズニー')                    # ディズニー
$disneySlugs = @($csv | Where-Object { $_.$colCat -match $reDisney } | ForEach-Object { $_.slug })

$reTelDt   = [regex]::Unescape('<dt>電話</dt><dd>([^<]+)</dd>')
$reAddrDt  = [regex]::Unescape('<dt>所在地</dt><dd>([^<]+)</dd>')
$reInOutDt = '<dt>IN / OUT</dt><dd>([^<]+)</dd>'
$rePriceDt = [regex]::Unescape('<dt>価格の目安</dt><dd>[^0-9]*([0-9,]+)円')
$reHE      = [regex]::Unescape('ハッピーエントリー') # ハッピーエントリー
$reHENeg   = [regex]::Unescape('対象外|ありません|できません|利用不可|なし|除く')
$reCheck   = [regex]::Unescape('要確認')                               # 要確認
$reStale   = [regex]::Unescape('20(25|26)年[0-9]{1,2}月[^。<]{0,25}(予定|見込み)')
$rePref    = [regex]::Unescape('千葉県|東京都|浦安市|市川市|江戸川区')
$reZip     = [regex]::Unescape('〒[0-9\-]+')

$pages = Get-ChildItem (Join-Path $root "content\travel-guide\hotels\*.md") |
  Where-Object { $_.Name -notmatch '\.(en|zh|zh-tw|ko)\.md$' -and $_.BaseName -notin @('_index','compare','kids','budget','access','shuttle','happy-entry','types') }

$report = @()
foreach ($p in $pages) {
  $slug = $p.BaseName
  $md = [System.IO.File]::ReadAllText($p.FullName, [Text.Encoding]::UTF8)
  $row = $csv | Where-Object { $_.slug -eq $slug }
  if (-not $row) { $report += "[$slug] NO CSV ROW"; continue }

  $tel   = if ($md -match $reTelDt)   { $Matches[1].Trim() } else { $null }
  $addr  = if ($md -match $reAddrDt)  { $Matches[1].Trim() } else { $null }
  $inout = if ($md -match $reInOutDt) { $Matches[1].Trim() } else { $null }
  $price = if ($md -match $rePriceDt) { [int]($Matches[1] -replace ',','') } else { $null }
  $url   = if ($md -match 'class="hg-info-btn" href="([^"]+)"') { $Matches[1].Trim() } else { $null }

  if ($tel -and $row.$colTel -and $row.$colTel -notmatch $reCheck) {
    $t1 = $tel -replace '[^0-9]',''; $t2 = $row.$colTel -replace '[^0-9]',''
    if ($t1 -ne $t2) { $report += "[$slug] TEL: md=$tel / csv=$($row.$colTel)" }
  }
  if ($addr -and $row.$colAddr) {
    $csvAddr = ($row.$colAddr -replace $rePref,'').Trim()
    $mdAddr  = ($addr -replace $reZip,'').Trim()
    if ($csvAddr -and ($mdAddr -notmatch [regex]::Escape($csvAddr))) {
      $report += "[$slug] ADDR: md=$mdAddr / csv=$($row.$colAddr)"
    }
  }
  if ($inout -and $row.$colInOut -and $row.$colInOut -notmatch $reCheck) {
    $io1 = @([regex]::Matches($inout, '\d{1,2}:\d{2}') | ForEach-Object { $_.Value })
    $io2 = @([regex]::Matches($row.$colInOut, '\d{1,2}:\d{2}') | ForEach-Object { $_.Value })
    if ($io1.Count -ge 2 -and $io2.Count -ge 2) {
      if (($io1[0] -ne $io2[0]) -or ($io1[-1] -ne $io2[-1])) {
        $report += "[$slug] INOUT: md=$inout / csv=$($row.$colInOut)"
      }
    }
  }
  if ($price -and $row.$colPrice) {
    $csvPrice = [int]($row.$colPrice -replace '[^0-9]','')
    if ($price -ne $csvPrice) { $report += "[$slug] PRICE: md=$price / csv=$csvPrice" }
  }
  if ($url -and $row.$colUrl -and $row.$colUrl -match '^http') {
    $d1 = ([uri]$url).Host; $d2 = ([uri]$row.$colUrl).Host
    if ($d1 -ne $d2) { $report += "[$slug] URL: md=$d1 / csv=$d2" }
  }
  if ($md -match $reHE -and ($slug -notin $disneySlugs)) {
    $lines = ($md -split "`n") | Where-Object { $_ -match $reHE }
    foreach ($l in $lines) {
      if ($l -notmatch $reHENeg) {
        $t = $l.Trim(); if ($t.Length -gt 90) { $t = $t.Substring(0,90) }
        $report += "[$slug] HAPPY-ENTRY(non-disney): $t"
      }
    }
  }
  foreach ($m in [regex]::Matches($md, $reStale)) { $report += "[$slug] STALE-DATE: $($m.Value)" }
}
"=== MISMATCHES: $($report.Count) ==="
$report | ForEach-Object { $_ }
