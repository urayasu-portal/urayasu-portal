# X手動投稿の補助ツール。公開済みRSSから記事を選び、投稿文の下書きをクリップボードにコピーする。
#
# 使い方（リポジトリのルートで）:
#   .\scripts\x-post-clip.ps1            → 最新記事の投稿文をコピー
#   .\scripts\x-post-clip.ps1 3          → 新着3番目の記事をコピー
#   .\scripts\x-post-clip.ps1 -List     → 新着10件を番号付きで一覧表示（コピーなし）
#
# コピーされる形式（貼り付け後、タイトルの下に地元目線のひとことを1行足すのがおすすめ）:
#   【浦安】○○○○
#
#   https://urayasu-portal.com/posts/...
#   #浦安
param(
  [int]$Index = 1,
  [switch]$List
)

$wc = New-Object System.Net.WebClient
$wc.Encoding = [System.Text.Encoding]::UTF8
try {
  $xml = [xml]$wc.DownloadString("https://urayasu-portal.com/posts/index.xml")
} catch {
  Write-Host "RSSの取得に失敗しました: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
$items = @($xml.rss.channel.item)

if ($List) {
  Write-Host "―― 新着10件 ――" -ForegroundColor Cyan
  $n = [Math]::Min(10, $items.Count)
  for ($i = 0; $i -lt $n; $i++) {
    "{0,2}. {1}" -f ($i + 1), $items[$i].title
  }
  Write-Host "`n番号を指定してコピー: .\scripts\x-post-clip.ps1 <番号>" -ForegroundColor DarkGray
  exit 0
}

if ($Index -lt 1 -or $Index -gt $items.Count) {
  Write-Host "番号が範囲外です（1〜$($items.Count)）。-List で一覧を確認してください。" -ForegroundColor Red
  exit 1
}

$it = $items[$Index - 1]
$text = "$($it.title)`n`n$($it.link)`n#浦安"

try {
  Set-Clipboard -Value $text
  Write-Host "クリップボードにコピーしました。Xに貼り付けて、タイトルの下にひとこと足してから投稿してください。" -ForegroundColor Green
} catch {
  Write-Host "クリップボードへのコピーに失敗しました。下のテキストを手動でコピーしてください。" -ForegroundColor Yellow
}
Write-Host "―――――――――――――――" -ForegroundColor DarkGray
$text
Write-Host "―――――――――――――――" -ForegroundColor DarkGray
