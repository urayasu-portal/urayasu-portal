<#
.SYNOPSIS
  ホテルCSVマスターから Hugo データファイルを一括再生成する。

.DESCRIPTION
  hotel-database-full.csv を編集したあと本スクリプトを1回実行すれば、
  data/hotels.yaml（区分・カテゴリ・特徴・価格・表示名）と
  data/hotels_map.yaml（座標・フラグ・住所）の両方が再生成される。

  通常の更新手順：
    1. hotel-database-full.csv を Excel / Google Sheets で編集
    2. powershell -File scripts/build-all.ps1
    3. hugo --minify でビルド

.EXAMPLE
  powershell -File scripts/build-all.ps1
#>

$ErrorActionPreference = "Stop"
$dir = $PSScriptRoot

Write-Output "[1/2] data/hotels.yaml を生成中..."
powershell -ExecutionPolicy Bypass -File (Join-Path $dir "build-hotels.ps1")

Write-Output ""
Write-Output "[2/2] data/hotels_map.yaml を生成中..."
powershell -ExecutionPolicy Bypass -File (Join-Path $dir "build-hotels-map.ps1")

Write-Output ""
Write-Output "===================================================="
Write-Output " 完了。次に `hugo --minify` でビルドしてください。"
Write-Output "===================================================="
