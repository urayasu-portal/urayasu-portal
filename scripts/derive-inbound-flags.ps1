<#
.SYNOPSIS
  facility-database.csv の hours / status からインバウンド向け時間帯フラグを導出して同CSVに書き戻す。

.DESCRIPTION
  導出列（毎回再計算・手動編集しない）：
    open_early : 開店 7:00 以前の曜日パターンあり（パーク開園前の朝食・買い出し向け）
    open_late  : 閉店 22:00 以降（「翌X:00」は +24h 換算。パーク閉園後の夕食向け）
    is_24h     : hours に「24時間」を含む
  手動管理列（本スクリプトは列が無ければ追加するだけで、値には触らない）：
    atm_intl   : 1=海外カード対応ATMあり / check=要現地確認 / 空=なし・不明

  判定は status=open の行のみ。closed / planned は常に空欄。
  運用: hours や status を編集したら本スクリプトを再実行 → build-facilities.ps1 で YAML 再生成。
#>
param(
    [string]$CsvPath
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $CsvPath) {
    $root    = Split-Path $PSScriptRoot -Parent
    $CsvPath = Join-Path $root 'facility-database.csv'
}
if (-not (Test-Path $CsvPath)) { throw "マスターCSVが見つかりません: $CsvPath" }

# --- 読み込み（BOM・改行コードを保存時に維持するため生バイトから） ---
$bytes  = [System.IO.File]::ReadAllBytes($CsvPath)
$hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
$text   = [System.Text.Encoding]::UTF8.GetString($bytes)
if ($hasBom) { $text = $text.TrimStart([char]0xFEFF) }
if ($text.Contains('"')) { throw '二重引用符を含むセルがあります。このスクリプトは引用符付きCSV非対応です。' }

$nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
$trailingNl = $text.EndsWith("`n")
$lines = ($text -replace "`r`n", "`n") -split "`n"
if ($trailingNl) { $lines = $lines[0..($lines.Length - 2)] }

# --- ヘッダー処理（新列が無ければ末尾に追加） ---
$header    = $lines[0] -split ','
$origCount = $header.Length
foreach ($c in @('open_early','open_late','is_24h','atm_intl')) {
    if ($header -notcontains $c) { $header += $c }
}
$colCount = $header.Length
$iId     = [Array]::IndexOf($header, 'id')
$iHours  = [Array]::IndexOf($header, 'hours')
$iStatus = [Array]::IndexOf($header, 'status')
$iEarly  = [Array]::IndexOf($header, 'open_early')
$iLate   = [Array]::IndexOf($header, 'open_late')
$i24     = [Array]::IndexOf($header, 'is_24h')

# 「6:30～23:00」「7:00-24:00」「4:00～翌2:00」等の時間範囲をすべて拾う
$rangeRx = [regex]'(\d{1,2}):(\d{2})\s*[～〜~\-－–—]\s*(翌)?(\d{1,2}):(\d{2})'

$out = New-Object System.Collections.Generic.List[string]
$out.Add(($header -join ','))
$review = @()
$nEarly = 0; $nLate = 0; $n24 = 0

for ($i = 1; $i -lt $lines.Length; $i++) {
    $f = $lines[$i] -split ','
    if ($f.Length -ne $origCount) {
        throw "行 $($i + 1): 列数 $($f.Length)（期待 $origCount）。フィールド内カンマの可能性。"
    }
    while ($f.Length -lt $colCount) { $f += '' }

    $early = ''; $late = ''; $is24 = ''
    if ($f[$iStatus] -eq 'open') {
        $hours = $f[$iHours]
        if ($hours -match '24時間') { $is24 = '1'; $early = '1'; $late = '1' }
        $minS = $null; $maxE = $null
        foreach ($m in $rangeRx.Matches($hours)) {
            $s = [int]$m.Groups[1].Value * 60 + [int]$m.Groups[2].Value
            $e = [int]$m.Groups[4].Value * 60 + [int]$m.Groups[5].Value
            if ($m.Groups[3].Value -eq '翌') { $e += 1440 }
            if ($e -le $s) { $e += 1440 }
            if ($null -eq $minS -or $s -lt $minS) { $minS = $s }
            if ($null -eq $maxE -or $e -gt $maxE) { $maxE = $e }
        }
        if ($null -ne $minS -and $minS -le 420)  { $early = '1' }   # 7:00以前に開店
        if ($null -ne $maxE -and $maxE -ge 1320) { $late  = '1' }   # 22:00以降に閉店
        if ($is24 -eq '' -and $null -eq $minS) { $review += "$($f[$iId]) : $hours" }
    }
    $f[$iEarly] = $early; $f[$iLate] = $late; $f[$i24] = $is24
    if ($early -eq '1') { $nEarly++ }
    if ($late  -eq '1') { $nLate++ }
    if ($is24  -eq '1') { $n24++ }
    $out.Add(($f -join ','))
}

# --- 書き戻し（元のBOM有無・改行コードを維持） ---
$result = $out -join $nl
if ($trailingNl) { $result += $nl }
$enc = New-Object System.Text.UTF8Encoding($hasBom)
[System.IO.File]::WriteAllText($CsvPath, $result, $enc)

Write-Output "処理完了: $($lines.Length - 1) 行"
Write-Output "  open_early（～7:00開店）: $nEarly"
Write-Output "  open_late （22:00～閉店）: $nLate"
Write-Output "  is_24h    （24時間）    : $n24"
if ($review.Count -gt 0) {
    Write-Output "時間を判定できなかった営業中施設（フラグ空欄のまま）:"
    $review | ForEach-Object { Write-Output "  - $_" }
}
