<#
.SYNOPSIS
  public/ 配下の生成HTMLから内部リンクを全数抽出し、リンク先の実在を検査する。

.DESCRIPTION
  情報鮮度監査（/fact-check）の Step 1「内部リンク404」用。
  2026-09-08（第22回）に、それまでインラインで回していた検査に
  2つの欠陥が見つかったため、正しい実装をスクリプトとして固定した。

  【欠陥1】相対形式 href="/..." しか見ておらず、
           絶対形式 href="https://urayasu-portal.com/..." を検査対象外にしていた。
           実際には生成HTML内に絶対形式が4万件以上（ユニーク3,600種超）存在した。
  【欠陥2】%エンコードを含むURLを一律除外していたため、
           日本語スラッグの posts / categories / tags へのリンクが未検査だった。

  【注意】リンクのデコード結果とファイルシステム上の名前は Unicode 正規化形式が
         異なる場合がある（NFC/NFD）。単純な Test-Path では日本語パスが
         「存在しない」と誤判定されるため、両者を FormC に正規化して比較する。

  【前提】必ず public/ を削除してからクリンビルドすること。
         Hugo は削除・draft化されたページを public/ から自動削除しないため
         （ビルド統計の Cleaned が常に 0）、古い生成物が残っていると
         リンク切れを「存在する」と誤判定して偽陰性になる。
           Remove-Item -Recurse -Force public ; hugo --minify

.EXAMPLE
  powershell -NoProfile -File scripts\check-internal-links.ps1
#>
param(
  [string]$PublicDir = "public",
  [string]$BaseUrl   = "https://urayasu-portal.com"
)
$ErrorActionPreference = "Stop"

if (-not (Test-Path $PublicDir)) {
  Write-Error "$PublicDir がありません。先に hugo --minify を実行してください。"
}

function Get-NormalizedPath([string]$p) {
  return $p.Normalize([Text.NormalizationForm]::FormC)
}

# --- 1) 実在するURLパスの集合を作る（FormC 正規化）---
$exists = New-Object System.Collections.Generic.HashSet[string]
$root = (Resolve-Path $PublicDir).Path
Get-ChildItem -Path $PublicDir -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($root.Length).Replace([char]92, [char]47)
  [void]$exists.Add((Get-NormalizedPath $rel))
  if ($_.Name -eq 'index.html') {
    $dir = $rel -replace '/index\.html$',''
    [void]$exists.Add((Get-NormalizedPath ($dir + '/')))
    if ($dir -eq '') { [void]$exists.Add('/') }
  }
}

# --- 2) 生成HTMLから内部リンクを抽出（相対＋絶対の両形式）---
$links = New-Object System.Collections.Generic.HashSet[string]
$escBase = [regex]::Escape($BaseUrl)
Get-ChildItem -Path $PublicDir -Recurse -Filter *.html | ForEach-Object {
  $t = [IO.File]::ReadAllText($_.FullName)
  foreach ($m in [regex]::Matches($t, 'href="(/[^"#?]*)"'))            { [void]$links.Add($m.Groups[1].Value) }
  foreach ($m in [regex]::Matches($t, "href=`"$escBase(/[^`"#?]*)`"")) { [void]$links.Add($m.Groups[1].Value) }
}

# --- 3) 実在判定（%デコード＋FormC 正規化）---
$missing = New-Object System.Collections.Generic.List[string]
foreach ($u in $links) {
  $d = Get-NormalizedPath ([System.Uri]::UnescapeDataString($u))
  if ($exists.Contains($d)) { continue }
  if ($exists.Contains($d.TrimEnd('/') + '/')) { continue }
  if ($exists.Contains($d.TrimEnd('/') + '/index.html')) { continue }
  $missing.Add($u)
}

Write-Output "==================================================================="
Write-Output "内部リンク検査（相対＋絶対・%デコード・Unicode正規化）"
Write-Output "  生成ファイル : $($exists.Count) パス"
Write-Output "  内部リンク   : $($links.Count) 種"
Write-Output "  リンク切れ   : $($missing.Count) 件"
Write-Output "==================================================================="
$tmpl = $missing | Where-Object { $_ -like "*`${*" }
$real = $missing | Where-Object { $_ -notlike "*`${*" }
Write-Output "  うち未展開テンプレート変数（誤検出）: $($tmpl.Count) 件"
Write-Output "  実害のあるリンク切れ            : $($real.Count) 件"
if ($real.Count -gt 0) {
  $real | Sort-Object | ForEach-Object { Write-Output "  [404] $_" }

}
exit 0
