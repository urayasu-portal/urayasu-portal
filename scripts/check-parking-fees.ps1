<#
.SYNOPSIS
  ホテル記事（全5言語）に書かれた駐車料金を、CSV マスターの「駐車場」列と突き合わせる。

.DESCRIPTION
  情報鮮度監査（/fact-check）の Step 1 用。2026-10-03（第32回）に新設。

  駐車料金はホテルごとに体系がまちまち（1泊目/2泊目以降・累進・平日/土日祝・12時間ごと等）で、
  ko/zh/zh-tw では title・description（frontmatter）にも金額が入っている。frontmatter では
  {{< fact >}} ショートコードが使えないため、data/travel_facts.yaml への一元化はせず、
  「CSV（hotel-database-full.csv の駐車場列）を正本とし、記事側の金額が CSV に存在するかを機械的に検査する」
  方式を採った。料金改定時に CSV だけ直して翻訳版へ展開し忘れる事故（第13・16・17回で再発）を検出する。

  判定:
    記事の「駐車」キーワード（駐車 / parking / 주차 / 停车 / 停車）の直後にある金額のうち、
    CSV の駐車場列に現れない金額を「CSVに無い金額」として報告する。
    金額を読む範囲は、キーワードを含む文・表のセルまで（同じ行の宿泊料金を拾わないため）。
    表の見出しセル（| **駐車場** |）の場合は隣のセルまで読む。

  限界:
    ・金額以外（台数・予約要否・車高制限）は検査しない
    ・ハブ記事（budget 等、複数ホテルを並べる記事）はホテルとの対応が取れないため対象外
    ・「24時間で1,000円」のように CSV の料金から計算した金額を書いている場合も報告される
      （CSV に計算前の料金しか無いため）。内容を見て、CSV 側に追記するか記事を直すかを判断する

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-parking-fees.ps1
#>
param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$utf8 = New-Object System.Text.UTF8Encoding($false)
$csv  = Import-Csv (Join-Path $Root 'hotel-database-full.csv') -Encoding UTF8
$kwRe  = '駐車|[Pp]arking|주차|停车|停車'
# ¥N ／ A–B円（範囲。zh/zh-tw は 2026-10-04 から「1,000–3,000日元」のように末尾にだけ通貨名）／ N円
$amtRe = '(?:¥\s*([\d,]{3,}))|(?:([\d,]{3,})\s?[–〜～~\-]\s?([\d,]{3,})\s*(?:円|엔|日元|日圓))|(?:([\d,]{3,})\s*(?:円|엔|日元|日圓))'

function Get-Amounts([string]$s) {
  $set = New-Object 'System.Collections.Generic.SortedSet[int]'
  foreach ($m in [regex]::Matches($s, $amtRe)) {
    foreach ($g in 1..4) {
      if (-not $m.Groups[$g].Success) { continue }
      $n = 0
      if ([int]::TryParse(($m.Groups[$g].Value -replace ',', ''), [ref]$n) -and $n -ge 100) { [void]$set.Add($n) }
    }
  }
  return ,$set
}

# キーワードの位置から、その文・表のセルの終わりまでを切り出す
function Get-Window([string]$line, [int]$at) {
  $rest = $line.Substring($at)
  $cells = $rest -split '\|'
  $seg = $cells[0]
  # 表の見出しセル（金額が無い）なら隣のセルまで読む
  if ($cells.Count -gt 1 -and (Get-Amounts $seg).Count -eq 0) { $seg = $seg + '|' + $cells[1] }
  # 文の終わり（。／英文のピリオド＋空白／全角セミコロン）で切る
  $end = [regex]::Match($seg, '。|\.\s|；')
  if ($end.Success) { $seg = $seg.Substring(0, $end.Index) }
  return $seg
}

# 許可リスト（scripts/check-parking-fees.allow.txt）：ファイル名<TAB>金額<TAB>理由
$allow = @{}
$allowFile = Join-Path $PSScriptRoot 'check-parking-fees.allow.txt'
if (Test-Path $allowFile) {
  foreach ($a in [IO.File]::ReadAllLines($allowFile, $utf8)) {
    if ($a -match '^\s*(#|$)') { continue }
    $p = $a -split "`t"
    if ($p.Count -ge 2) { $allow["$($p[0].Trim())|$($p[1].Trim())"] = $true }
  }
}

$issues = @()
$checked = 0
$allowed = 0
foreach ($r in $csv) {
  $slug = ($r.slug).Trim()
  if (-not $slug) { continue }
  $csvAmt = Get-Amounts $r.'駐車場'
  foreach ($l in '', '.en', '.ko', '.zh', '.zh-tw') {
    $f = Join-Path $Root "content\travel-guide\hotels\$slug$l.md"
    if (-not (Test-Path $f)) { continue }
    $checked++
    $lineNo = 0
    foreach ($ln in ([IO.File]::ReadAllText($f, $utf8) -split "`n")) {
      $lineNo++
      foreach ($k in [regex]::Matches($ln, $kwRe)) {
        $win = Get-Window $ln $k.Index
        $extra = @((Get-Amounts $win) | Where-Object { -not $csvAmt.Contains($_) })
        $skip = @($extra | Where-Object { $allow.ContainsKey("$slug$l.md|$_") })
        $allowed += $skip.Count
        $extra = @($extra | Where-Object { -not $allow.ContainsKey("$slug$l.md|$_") })
        if ($extra.Count) {
          $issues += [pscustomobject]@{
            File     = "$slug$l.md:$lineNo"
            NotInCSV = ($extra -join ',')
            CSV      = ($csvAmt -join ',')
            Text     = ($win.Trim() -replace '\s+', ' ').Substring(0, [Math]::Min(70, $win.Trim().Length))
          }
        }
      }
    }
  }
}

$issues = $issues | Sort-Object File -Unique
'==================================================================='
'駐車料金チェック（ホテル記事 全言語 × CSV 駐車場列）'
'  検査ファイル      : {0}' -f $checked
'  CSVに無い金額     : {0} 箇所' -f @($issues).Count
'  許可リストで除外  : {0} 件（check-parking-fees.allow.txt）' -f $allowed
'==================================================================='
if ($issues) { $issues | Format-Table -AutoSize -Wrap | Out-String -Width 220 }
exit ([int](@($issues).Count -gt 0))
