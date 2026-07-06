<#
.SYNOPSIS
  hotel-database-full.csv（唯一のマスター）から data/hotels_map.yaml を生成する。

.DESCRIPTION
  ホテルの座標・機能フラグ・最低価格は CSV に集約されている。
  比較マップ（/travel-guide/hotels/compare/）が参照する data/hotels_map.yaml は
  本スクリプトで生成する自動生成物であり、直接編集しないこと。

  座標やフラグを変更したいときは：
    1. hotel-database-full.csv を Excel / Google Sheets で編集
    2. 本スクリプトを実行して data/hotels_map.yaml を再生成
    3. hugo でビルド

  CSV の関連列：
    slug        … 一意キー（必須。空の行＝name-only等はスキップ）
    緯度 / 経度  … 数値。緯度が空の行は地図対象外としてスキップ
    機能フラグ    … セミコロン区切り（例 "shuttle;bath;limousine"）→ YAML配列に変換
    最低価格      … ソート用の整数（円）。空なら 0

.EXAMPLE
  powershell -File scripts/build-hotels-map.ps1
#>

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root    = Split-Path $PSScriptRoot -Parent
$csvPath = Join-Path $root "hotel-database-full.csv"
$outPath = Join-Path $root "data\hotels_map.yaml"

if (-not (Test-Path $csvPath)) { throw "マスターCSVが見つかりません: $csvPath" }

$csv = Import-Csv $csvPath -Encoding UTF8

# ホテル名の中文表記（slug→简体中文）。比較マップ(/zh/)のポップアップ・地図用。
# ※ build-hotels.ps1 の $nameZh と同内容。どちらか変更時は両方更新すること。
$nameZh = @{
  "tdl-hotel"                     = "东京迪士尼乐园大饭店"
  "miracosta"                     = "东京迪士尼海洋观海景大饭店 米拉柯斯达"
  "fantasy-springs-hotel"         = "东京迪士尼海洋梦幻泉乡大饭店"
  "ambassador-hotel"              = "迪士尼大使大饭店"
  "toy-story-hotel"               = "东京迪士尼度假区玩具总动员饭店"
  "celebration-wish"              = "东京迪士尼欢庆饭店：愿望"
  "celebration-discover"          = "东京迪士尼欢庆饭店：探索"
  "hotel-okura-tokyo-bay"         = "东京湾大仓酒店"
  "grand-nikko-tokyo-bay"         = "东京湾舞滨格兰日航酒店"
  "sheraton-grande-tokyo-bay"     = "东京湾喜来登大酒店"
  "hilton-tokyo-bay"              = "东京湾希尔顿酒店"
  "maihama-hotel-first-resort"    = "东京湾舞滨酒店 第一度假村"
  "maihama-view-hotel"            = "舞滨观景酒店 by HULIC"
  "dreamgate-maihama"             = "舞滨梦想之门酒店"
  "royal-park-maihama"            = "舞滨皇家花园酒店 东京湾"
  "mystays-maihama"               = "舞滨MyStays酒店"
  "maihama-eurasia"               = "SPA&HOTEL 舞滨欧亚"
  "eurasia-annex"                 = "HOTEL 欧亚舞滨 ANNEX"
  "hyatt-regency-tokyo-bay"       = "东京湾凯悦酒店"
  "comfort-suites-tokyo-bay"      = "东京湾凯富套房酒店"
  "brighton-tokyo-bay"            = "浦安布莱顿酒店 东京湾"
  "oriental-tokyo-bay"            = "东京湾东方酒店"
  "emion-tokyo-bay"               = "东京湾艾米恩酒店"
  "mitsui-garden-prana"           = "三井花园酒店 普拉纳东京湾"
  "hoshinoresorts-1955-tokyo-bay" = "星野集团 1955 东京湾"
  "lagent-tokyo-bay"              = "东京湾拉珍特酒店"
  "ibis-styles-tokyo-bay"         = "东京湾宜必思尚品酒店"
  "mystays-shin-urayasu"          = "新浦安MyStays会议中心酒店"
  "flexstay-shin-urayasu"         = "新浦安Flexstay Inn"
  "henna-hotel-maihama"           = "海茵娜酒店 舞滨东京湾"
  "four-stories-hotel"            = "舞滨四物语酒店 东京湾"
  "hiyori-hotel-maihama"          = "舞滨日和酒店"
  "viewfort-urayasu"              = "浦安景堡酒店"
  "hotel-daigo-urayasu"           = "醍醐酒店"
  "bayhotel-urayasu"              = "浦安站前 BAY HOTEL"
  "urayasu-sun-hotel"             = "浦安阳光酒店"
  "premium-monday-maihama-view-1" = "Premium hotel MONday 舞滨景观Ⅰ"
  "hotel-seaside-edogawa"         = "江户川海滨酒店"
  "cvs-bay-hotel"                 = "CVS·BAY HOTEL"
  "hotel-ilfiore-kasai"           = "葛西菲奥雷酒店"
  "hotel-ilfiore-kasai-annex"     = "葛西菲奥雷酒店 ANNEX"
  "hotel-lumiere-kasai"           = "葛西卢米埃尔酒店"
  "livemax-kasai-ekimae"          = "LiVEMAX葛西站前酒店"
  "superhotel-myoden"             = "超级酒店 东西线·市川·妙典站前"
}

# ホテル名の韓国語表記（slug→한국어）。比較マップ(/ko/)のポップアップ・地図用。
# ※ build-hotels.ps1 の $nameKo と同内容。どちらか変更時は両方更新すること。
$nameKo = @{
  "tdl-hotel"                     = "도쿄디즈니랜드 호텔"
  "miracosta"                     = "도쿄디즈니씨 호텔 미라코스타"
  "fantasy-springs-hotel"         = "도쿄디즈니씨 판타지 스프링스 호텔"
  "ambassador-hotel"              = "디즈니 앰버서더 호텔"
  "toy-story-hotel"               = "도쿄디즈니리조트 토이 스토리 호텔"
  "celebration-wish"              = "도쿄디즈니 셀러브레이션 호텔: 위시"
  "celebration-discover"          = "도쿄디즈니 셀러브레이션 호텔: 디스커버"
  "hotel-okura-tokyo-bay"         = "호텔 오쿠라 도쿄 베이"
  "grand-nikko-tokyo-bay"         = "그랜드 니코 도쿄 베이 마이하마"
  "sheraton-grande-tokyo-bay"     = "쉐라톤 그란데 도쿄 베이 호텔"
  "hilton-tokyo-bay"              = "힐튼 도쿄 베이"
  "maihama-hotel-first-resort"    = "도쿄 베이 마이하마 호텔 퍼스트 리조트"
  "maihama-view-hotel"            = "마이하마 뷰 호텔 by HULIC"
  "dreamgate-maihama"             = "호텔 드림게이트 마이하마"
  "royal-park-maihama"            = "더 로열 파크 호텔 마이하마 리조트 도쿄 베이"
  "mystays-maihama"               = "호텔 마이스테이즈 마이하마"
  "maihama-eurasia"               = "스파&호텔 마이하마 유라시아"
  "eurasia-annex"                 = "호텔 유라시아 마이하마 ANNEX"
  "hyatt-regency-tokyo-bay"       = "하얏트 리젠시 도쿄 베이"
  "comfort-suites-tokyo-bay"      = "컴포트 스위트 도쿄 베이"
  "brighton-tokyo-bay"            = "우라야스 브라이튼 호텔 도쿄 베이"
  "oriental-tokyo-bay"            = "오리엔탈 호텔 도쿄 베이"
  "emion-tokyo-bay"               = "호텔 에미온 도쿄 베이"
  "mitsui-garden-prana"           = "미쓰이 가든 호텔 프라나 도쿄 베이"
  "hoshinoresorts-1955-tokyo-bay" = "호시노 리조트 1955 도쿄 베이"
  "lagent-tokyo-bay"              = "라젠트 호텔 도쿄 베이"
  "ibis-styles-tokyo-bay"         = "이비스 스타일스 도쿄 베이"
  "mystays-shin-urayasu"          = "마이스테이즈 신우라야스 컨퍼런스 센터"
  "flexstay-shin-urayasu"         = "플렉스테이 인 신우라야스"
  "henna-hotel-maihama"           = "헨나 호텔 마이하마 도쿄 베이"
  "four-stories-hotel"            = "포 스토리즈 호텔 마이하마 도쿄 베이"
  "hiyori-hotel-maihama"          = "히요리 호텔 마이하마"
  "viewfort-urayasu"              = "우라야스 뷰포트 호텔"
  "hotel-daigo-urayasu"           = "호텔 다이고"
  "bayhotel-urayasu"              = "우라야스역앞 베이 호텔"
  "urayasu-sun-hotel"             = "우라야스 선 호텔"
  "premium-monday-maihama-view-1" = "Premium hotel MONday 마이하마 뷰Ⅰ"
  "hotel-seaside-edogawa"         = "호텔 시사이드 에도가와"
  "cvs-bay-hotel"                 = "CVS·BAY HOTEL"
  "hotel-ilfiore-kasai"           = "호텔 일 피오레 가사이"
  "hotel-ilfiore-kasai-annex"     = "호텔 일 피오레 가사이 ANNEX"
  "hotel-lumiere-kasai"           = "호텔 뤼미에르 가사이"
  "livemax-kasai-ekimae"          = "호텔 리브맥스 가사이역앞"
  "superhotel-myoden"             = "슈퍼호텔 도자이선·이치카와·묘덴역앞"
}

# ホテル名の繁体字表記（slug→繁體中文・台湾語彙）。比較マップ(/zh-tw/)のポップアップ・地図用。
# ※ build-hotels.ps1 の $nameZhTw と同内容。どちらか変更時は両方更新すること。
$nameZhTw = @{
  "tdl-hotel"                     = "東京迪士尼樂園大飯店"
  "miracosta"                     = "東京迪士尼海洋觀海景大飯店 米拉柯斯達"
  "fantasy-springs-hotel"         = "東京迪士尼海洋夢幻泉鄉大飯店"
  "ambassador-hotel"              = "迪士尼大使大飯店"
  "toy-story-hotel"               = "東京迪士尼度假區玩具總動員飯店"
  "celebration-wish"              = "東京迪士尼樂祥飯店：願望"
  "celebration-discover"          = "東京迪士尼樂祥飯店：探索"
  "hotel-okura-tokyo-bay"         = "東京灣大倉飯店"
  "grand-nikko-tokyo-bay"         = "東京灣舞濱格蘭日航飯店"
  "sheraton-grande-tokyo-bay"     = "東京灣喜來登大飯店"
  "hilton-tokyo-bay"              = "東京灣希爾頓飯店"
  "maihama-hotel-first-resort"    = "東京灣舞濱飯店 第一度假村"
  "maihama-view-hotel"            = "舞濱觀景飯店 by HULIC"
  "dreamgate-maihama"             = "舞濱夢想之門飯店"
  "royal-park-maihama"            = "舞濱皇家花園飯店 東京灣"
  "mystays-maihama"               = "舞濱MyStays飯店"
  "maihama-eurasia"               = "SPA&HOTEL 舞濱歐亞"
  "eurasia-annex"                 = "HOTEL 歐亞舞濱 ANNEX"
  "hyatt-regency-tokyo-bay"       = "東京灣凱悅飯店"
  "comfort-suites-tokyo-bay"      = "東京灣凱富套房飯店"
  "brighton-tokyo-bay"            = "浦安布萊頓飯店 東京灣"
  "oriental-tokyo-bay"            = "東京灣東方飯店"
  "emion-tokyo-bay"               = "東京灣艾米恩飯店"
  "mitsui-garden-prana"           = "三井花園飯店 普拉納東京灣"
  "hoshinoresorts-1955-tokyo-bay" = "星野集團 1955 東京灣"
  "lagent-tokyo-bay"              = "東京灣拉珍特飯店"
  "ibis-styles-tokyo-bay"         = "東京灣宜必思尚品飯店"
  "mystays-shin-urayasu"          = "新浦安MyStays會議中心飯店"
  "flexstay-shin-urayasu"         = "新浦安Flexstay Inn"
  "henna-hotel-maihama"           = "海茵娜飯店 舞濱東京灣"
  "four-stories-hotel"            = "舞濱四物語飯店 東京灣"
  "hiyori-hotel-maihama"          = "舞濱日和飯店"
  "viewfort-urayasu"              = "浦安景堡飯店"
  "hotel-daigo-urayasu"           = "醍醐飯店"
  "bayhotel-urayasu"              = "浦安站前 BAY HOTEL"
  "urayasu-sun-hotel"             = "浦安陽光飯店"
  "premium-monday-maihama-view-1" = "Premium hotel MONday 舞濱景觀Ⅰ"
  "hotel-seaside-edogawa"         = "江戶川海濱飯店"
  "cvs-bay-hotel"                 = "CVS·BAY HOTEL"
  "hotel-ilfiore-kasai"           = "葛西菲奧雷飯店"
  "hotel-ilfiore-kasai-annex"     = "葛西菲奧雷飯店 ANNEX"
  "hotel-lumiere-kasai"           = "葛西盧米埃爾飯店"
  "livemax-kasai-ekimae"          = "LiVEMAX葛西站前飯店"
  "superhotel-myoden"             = "超級飯店 東西線·市川·妙典站前"
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# === 自動生成ファイル / DO NOT EDIT ===")
[void]$sb.AppendLine("# マスター: hotel-database-full.csv")
[void]$sb.AppendLine("# 生成:     scripts/build-hotels-map.ps1")
[void]$sb.AppendLine("# 座標・フラグ・最低価格を変えるときはCSVを編集して本スクリプトで再生成すること。")
[void]$sb.AppendLine("# flags: bath=大浴場・温泉, pool=室内プール, laundry=コインランドリー,")
[void]$sb.AppendLine("#         convenience=館内売店, shuttle=無料シャトル, station=駅直結/徒歩1分,")
[void]$sb.AppendLine("#         limousine=空港リムジン, kitchen=ミニキッチン")
[void]$sb.AppendLine("# facilities: 個別ページの設備アイコン用（key + 任意のnote）。CSV機能フラグの key:note を展開。")
[void]$sb.AppendLine("# booking: 予約リンク（rakuten/jalan/booking/agoda）。CSVの各URL列に値がある時だけ出力。")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("hotels:")

$count = 0
foreach ($r in $csv) {
  if ($r."掲載区分" -eq "名称・カテゴリのみ掲載") { continue }  # 名称のみ掲載は地図対象外（座標があっても出さない）
  $slug = ($r.slug).Trim()
  if (-not $slug) { continue }                 # slug無し（name-only等）はスキップ
  $lat = ($r."緯度").Trim()
  $lng = ($r."経度").Trim()
  if (-not $lat -or -not $lng) { continue }    # 座標無しは地図対象外

  $pm = 0
  if (($r."最低価格").Trim() -match '^[0-9]+$') { $pm = [int]($r."最低価格").Trim() }

  # 機能フラグを key / key:note の配列にパース
  $items = @()
  $fraw = ($r."機能フラグ").Trim()
  if ($fraw) {
    foreach ($f in ($fraw -split ';' | Where-Object { $_.Trim() })) {
      $kv = $f.Trim() -split ':', 2
      $note = ""
      if ($kv.Count -gt 1) { $note = $kv[1].Trim() }
      $items += [pscustomobject]@{ key = $kv[0].Trim(); note = $note }
    }
  }
  # flags: note を外した素のキー配列（比較マップ・フィルタ用）
  $flags = (($items | ForEach-Object { $_.key }) -join ', ')

  [void]$sb.AppendLine("  - slug: ""$slug""")
  [void]$sb.AppendLine("    lat: $lat")
  [void]$sb.AppendLine("    lng: $lng")
  [void]$sb.AppendLine("    price_min: $pm")
  [void]$sb.AppendLine("    flags: [$flags]")
  # facilities: 個別ページの設備アイコン用（key + 任意note）
  if ($items.Count -gt 0) {
    [void]$sb.AppendLine("    facilities:")
    foreach ($it in $items) {
      [void]$sb.AppendLine("      - key: ""$($it.key)""")
      if ($it.note) { [void]$sb.AppendLine("        note: ""$($it.note)""") }
    }
  } else {
    [void]$sb.AppendLine("    facilities: []")
  }
  # 予約リンク（アフィリエイト）。提携ASPに合わせた構成：
  #   JA      → 楽天トラベル(楽天アフィリ・既存) ＋ じゃらん/Yahoo!トラベル(CSV列に値があれば)
  #   en      → Booking.com … CSVのBookingURL列(ホテル個別ページURL)があればそこへ直接遷移。
  #             空なら施設名(英語)の検索結果URLをテンプレート側で自動生成(フォールバック)。
  #   ko      → Expedia(co.jp) … 施設名(英語)の検索URLを自動生成 ＋ Agoda(CSV列に値があれば)
  # ※ Booking.com/Agoda/Expedia のアフィリ化はバリューコマース LinkSwitch（vc_pid設定後に自動変換）。
  $bk = @()
  if (($r.'楽天トラベルURL').Trim()) { $bk += "      rakuten: ""$(($r.'楽天トラベルURL').Trim())""" }
  if (($r.'じゃらんURL').Trim())     { $bk += "      jalan: ""$(($r.'じゃらんURL').Trim())""" }
  if (($r.'BookingURL').Trim())      { $bk += "      booking: ""$(($r.'BookingURL').Trim())""" }
  $exname = ($r.'英語表記').Trim()
  if (-not $exname) { $exname = ($r.'施設名').Trim() }
  $exquery = [uri]::EscapeDataString($exname)
  $bk += "      expedia: ""https://www.expedia.co.jp/Hotel-Search?destination=$exquery"""
  if (($r.'AgodaURL').Trim())        { $bk += "      agoda: ""$(($r.'AgodaURL').Trim())""" }
  if ($bk.Count -gt 0) {
    [void]$sb.AppendLine("    booking:")
    foreach ($b in $bk) { [void]$sb.AppendLine($b) }
  }
  [void]$sb.AppendLine("    name: ""$($r.'施設名')""")
  [void]$sb.AppendLine("    address: ""$($r.'住所')""")
  $nameEn = ($r.'英語表記').Trim()
  if (-not $nameEn) { $nameEn = ($r.'施設名').Trim() }
  [void]$sb.AppendLine("    name_en: ""$nameEn""")
  $nameZhV = ""
  if ($nameZh.ContainsKey($slug)) { $nameZhV = $nameZh[$slug] }
  if (-not $nameZhV) { $nameZhV = ($r.'施設名').Trim() }
  [void]$sb.AppendLine("    name_zh: ""$nameZhV""")
  $nameKoV = ""
  if ($nameKo.ContainsKey($slug)) { $nameKoV = $nameKo[$slug] }
  if (-not $nameKoV) { $nameKoV = ($r.'施設名').Trim() }
  [void]$sb.AppendLine("    name_ko: ""$nameKoV""")
  $nameZhTwV = ""
  if ($nameZhTw.ContainsKey($slug)) { $nameZhTwV = $nameZhTw[$slug] }
  if (-not $nameZhTwV) { $nameZhTwV = ($r.'施設名').Trim() }
  [void]$sb.AppendLine("    name_zh-tw: ""$nameZhTwV""")
  $count++
}

# BOMなしUTF-8で書き出し（HugoのYAMLパーサ対策）
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), $utf8NoBom)

Write-Output "生成完了: $outPath"
Write-Output "出力ホテル数: $count / CSV総行数: $($csv.Count)"
