<#
.SYNOPSIS
  hotel-database-full.csv（唯一のマスター）から data/hotels.yaml を生成する。

.DESCRIPTION
  ホテルの区分・カテゴリ・特徴・価格目安は CSV に集約されている。
  ホテル一覧(list)・比較マップ(compare)が参照する data/hotels.yaml は
  本スクリプトで生成する自動生成物であり、直接編集しないこと。

  区分やカテゴリを変えたいときは：
    1. hotel-database-full.csv を Excel / Google Sheets で編集
    2. 本スクリプトを実行して data/hotels.yaml を再生成
    3. hugo でビルド

  CSV列 → hotels.yaml フィールドの対応：
    表示名      → name（一覧・比較マップに出す短い名前。空なら施設名で代替）
    カテゴリ     → category（TDR公式区分に準拠：ディズニー/オフィシャル/パートナー/グッドネイバー/その他。ファッションは「—」）
    最低価格     → price_guide（"¥N〜"。0/空は ""）
    特徴ラベル    → feature
    掲載区分     → policy（通常掲載=normal / 名称・カテゴリのみ掲載=name-only）
    エリア記号    → どのエリアに属するか
  エリアの見出し・説明文(note)は本スクリプト内の定数で保持（CSVには無い）。

.EXAMPLE
  powershell -File scripts/build-hotels.ps1
#>

$ErrorActionPreference = "Stop"
$root    = Split-Path $PSScriptRoot -Parent
$csvPath = Join-Path $root "hotel-database-full.csv"
$outPath = Join-Path $root "data\hotels.yaml"

if (-not (Test-Path $csvPath)) { throw "マスターCSVが見つかりません: $csvPath" }
$csv = Import-Csv $csvPath -Encoding UTF8

# エリア定義（順序・見出し・説明文）。count はCSVから自動算出。
# name_en / note_en … 英語サイト(/en/)用。日本語をベースに、インバウンド向けに簡潔化。
$areas = @(
  [ordered]@{ id="a"; tag="A"; group="リゾート";   name="舞浜エリア";   note="ディズニーホテル・オフィシャル集中。パーク最至近。"; name_en="Maihama";       note_en="Disney & Official hotels, closest to the parks."; name_zh="舞滨地区";   note_zh="迪士尼饭店与官方饭店集中，离乐园最近。"; name_ko="마이하마 지역";   note_ko="디즈니 호텔·공식 호텔이 모여 있고 파크에서 가장 가깝습니다."; "name_zh-tw"="舞濱地區";   "note_zh-tw"="迪士尼飯店與官方飯店集中，離樂園最近。" }
  [ordered]@{ id="b"; tag="B"; group="リゾート";   name="千鳥エリア";   note="マイステイズ舞浜はTDS徒歩6分・最安値クラス。"; name_en="Chidori";       note_en="MYSTAYS Maihama is a 6-min walk to TDS, best-value class."; name_zh="千鸟地区";   note_zh="MyStays舞滨步行6分钟到迪士尼海洋，价位实惠。"; name_ko="치도리 지역";   note_ko="마이스테이즈 마이하마는 디즈니씨까지 도보 6분·최저가 클래스."; "name_zh-tw"="千鳥地區";   "note_zh-tw"="MyStays舞濱步行6分鐘到迪士尼海洋，價位實惠。" }
  [ordered]@{ id="c"; tag="C"; group="ベイサイド"; name="新町エリア";   note="日の出・明海のパートナーホテル集中。無料シャトル・空港リムジンも便利。"; name_en="Shinmachi";     note_en="Partner hotels in Hinode/Akemi. Free shuttles & airport limousines."; name_zh="新町地区";   note_zh="日出·明海的合作饭店集中，免费班车与机场巴士便利。"; name_ko="신마치 지역";   note_ko="히노데·아케미의 파트너 호텔이 모여 있고, 무료 셔틀·공항 리무진도 편리합니다."; "name_zh-tw"="新町地區";   "note_zh-tw"="日出·明海的合作飯店集中，免費班車與機場巴士便利。" }
  [ordered]@{ id="d"; tag="D"; group="ベイサイド"; name="新浦安エリア"; note="新浦安駅周辺（美浜・今川・東野）。京葉線で舞浜まで2駅。"; name_en="Shin-Urayasu";  note_en="Around Shin-Urayasu Stn. Two stops to Maihama on the Keiyo Line."; name_zh="新浦安地区"; note_zh="新浦安站周边（美浜·今川·东野）。京叶线到舞滨2站。"; name_ko="신우라야스 지역"; note_ko="신우라야스역 주변(미하마·이마가와·히가시노). 게이요선으로 마이하마까지 2개 역."; "name_zh-tw"="新浦安地區"; "note_zh-tw"="新浦安站周邊（美濱·今川·東野）。京葉線到舞濱2站。" }
  [ordered]@{ id="e"; tag="E"; group="リバーサイド"; name="元町エリア";   note="富士見など旧市街南側。旧江戸川沿いの落ち着いた住宅エリア。"; name_en="Motomachi";     note_en="Old-town south side along the Edogawa. Quiet residential area."; name_zh="元町地区";   note_zh="富士见等旧城区南侧。旧江户川沿岸的安静住宅区。"; name_ko="모토마치 지역";   note_ko="후지미 등 구시가지 남쪽. 옛 에도가와 강변의 차분한 주택가."; "name_zh-tw"="元町地區";   "note_zh-tw"="富士見等舊城區南側。舊江戶川沿岸的安靜住宅區。" }
  [ordered]@{ id="f"; tag="F"; group="リバーサイド"; name="浦安駅エリア"; note="東西線直通で都心1本。パークへはバス25〜30分。"; name_en="Urayasu Stn";   note_en="Direct to central Tokyo on the Tozai Line. 25-30 min by bus to the parks."; name_zh="浦安站地区"; note_zh="东西线直达市中心。到乐园乘巴士约25–30分钟。"; name_ko="우라야스역 지역"; note_ko="도자이선으로 도심까지 한 번에. 파크까지는 버스 25~30분."; "name_zh-tw"="浦安站地區"; "note_zh-tw"="東西線直達市中心。到樂園搭巴士約25–30分鐘。" }
  [ordered]@{ id="g"; tag="G"; group="浦安近郊";   name="浦安近郊";   note="葛西・市川・妙典など隣接エリア。電車で浦安・舞浜へ。"; name_en="Near Urayasu";  note_en="Adjacent Kasai/Ichikawa/Myoden. Train to Urayasu & Maihama."; name_zh="浦安近郊";   note_zh="葛西·市川·妙典等邻接地区。乘电车前往浦安·舞滨。"; name_ko="우라야스 근교";   note_ko="가사이·이치카와·묘덴 등 인접 지역. 전철로 우라야스·마이하마로 이동."; "name_zh-tw"="浦安近郊";   "note_zh-tw"="葛西·市川·妙典等鄰接地區。搭電車前往浦安·舞濱。" }
)

# 特徴ラベルの英訳（slug→英語）。英語サイトの一覧・比較マップ用。
# CSVの「特徴ラベル」(日本語)に対応。新規ホテル追加時はここにも1行加える。
$featureEn = @{
  "tdl-hotel"                     = "1-min walk to TDL"
  "miracosta"                     = "Inside TDS, private entrance"
  "fantasy-springs-hotel"         = "Connected to TDS Fantasy Springs (opened 2024)"
  "ambassador-hotel"              = "8-min walk from Maihama Stn"
  "toy-story-hotel"               = "3-min walk from Bayside Station"
  "celebration-wish"              = "Happy Entry perk included"
  "celebration-discover"          = "Happy Entry perk included"
  "hotel-okura-tokyo-bay"         = "Dedicated park shuttle"
  "grand-nikko-tokyo-bay"         = "Dedicated park shuttle"
  "sheraton-grande-tokyo-bay"     = "Large public bath & big pool"
  "hilton-tokyo-bay"              = "24h in-house convenience store"
  "maihama-hotel-first-resort"    = "Coin laundry on-site"
  "dreamgate-maihama"             = "Direct to JR Maihama Stn gate"
  "maihama-view-hotel"            = "Large public bath 'Spa Rose'"
  "royal-park-maihama"            = "Opened Feb 2026, up to 6 guests"
  "mystays-maihama"               = "6-min walk to TDS, area's best value"
  "maihama-eurasia"               = "Hot spring, open-air bath & sauna"
  "eurasia-annex"                 = "Discounted access to main-building hot spring"
  "hyatt-regency-tokyo-bay"       = "Limousine stop at hotel (new 2024)"
  "comfort-suites-tokyo-bay"      = "Shuttle 30 min after closing, kids sleep free"
  "brighton-tokyo-bay"            = "Direct to Shin-Urayasu Stn"
  "oriental-tokyo-bay"            = "Direct to Shin-Urayasu Stn"
  "emion-tokyo-bay"               = "Hot spring & open-air bath"
  "mitsui-garden-prana"           = "View public bath & in-house store"
  "hoshinoresorts-1955-tokyo-bay" = "In-house Lawson, opened 2024"
  "lagent-tokyo-bay"              = "Up to 6 guests, 24h store next door"
  "ibis-styles-tokyo-bay"         = "Accor design hotel"
  "mystays-shin-urayasu"          = "Reliably low rates"
  "flexstay-shin-urayasu"         = "Mini-kitchen in every room, long-stay"
  "henna-hotel-maihama"           = "Maihama Stn shuttle (reduced from Jul 2026)"
  "four-stories-hotel"            = "Local bus access (last bus 23:00)"
  "hiyori-hotel-maihama"          = "Foot massager & shoe dryer in every room"
  "viewfort-urayasu"              = "1-min walk from Urayasu Stn, buffet breakfast"
  "hotel-daigo-urayasu"           = "Flat rate year-round, no peak surcharge"
  "bayhotel-urayasu"              = "Kitchen, fridge & washer in every room"
  "urayasu-sun-hotel"             = "Free breakfast, 24h front desk"
  "premium-monday-maihama-view-1" = "Opened Dec 2025, free TDR shuttle"
  "grand-monday-resort-maihama"   = "Opens Jul 18 2026, all-oceanfront & year-round pool"
  "hotel-seaside-edogawa"         = "In Kasai Rinkai Park, 3-min walk, tatami rooms"
  "cvs-bay-hotel"                 = "Next to Ichikawa-Shiohama Stn, 2 stops to Maihama"
  "hotel-ilfiore-kasai"           = "3-min walk from Kasai Stn, up to 5 guests"
  "hotel-ilfiore-kasai-annex"     = "3-min walk from Kasai Stn, Il Fiore annex"
  "hotel-lumiere-kasai"           = "Business hotel, 2-min walk from Kasai Stn"
  "livemax-kasai-ekimae"          = "3-min walk from Kasai Stn, ~20 min bus to TDR"
  "superhotel-myoden"             = "By Myoden Stn, Tozai Line to Urayasu"
}

# 特徴ラベルの中文訳（slug→简体中文）。中国語サイト(/zh/)の一覧・比較マップ用。
$featureZh = @{
  "tdl-hotel"                     = "步行1分钟到迪士尼乐园"
  "miracosta"                     = "位于迪士尼海洋园区内·专用入口"
  "fantasy-springs-hotel"         = "直通迪士尼海洋梦幻泉乡（2024年开业）"
  "ambassador-hotel"              = "距舞滨站步行8分钟"
  "toy-story-hotel"               = "距海湾站步行3分钟"
  "celebration-wish"              = "含Happy Entry提前入园礼遇"
  "celebration-discover"          = "含Happy Entry提前入园礼遇"
  "hotel-okura-tokyo-bay"         = "专用乐园班车"
  "grand-nikko-tokyo-bay"         = "专用乐园班车"
  "sheraton-grande-tokyo-bay"     = "大浴场与大型泳池"
  "hilton-tokyo-bay"              = "馆内24小时便利店"
  "maihama-hotel-first-resort"    = "馆内自助洗衣"
  "dreamgate-maihama"             = "直通JR舞滨站检票口"
  "maihama-view-hotel"            = "大浴场「Spa Rose」"
  "royal-park-maihama"            = "2026年2月开业·最多入住6人"
  "mystays-maihama"               = "步行6分钟到迪士尼海洋·区域内超值"
  "maihama-eurasia"               = "天然温泉·露天浴池与桑拿"
  "eurasia-annex"                 = "可优惠使用本馆温泉"
  "hyatt-regency-tokyo-bay"       = "饭店门口设机场巴士站（2024新设）"
  "comfort-suites-tokyo-bay"      = "闭园后30分钟班车·儿童免费同住"
  "brighton-tokyo-bay"            = "直通新浦安站"
  "oriental-tokyo-bay"            = "直通新浦安站"
  "emion-tokyo-bay"               = "天然温泉与露天浴池"
  "mitsui-garden-prana"           = "景观大浴场与馆内商店"
  "hoshinoresorts-1955-tokyo-bay" = "馆内罗森便利店·2024开业"
  "lagent-tokyo-bay"              = "最多6人·隔壁24小时便利店"
  "ibis-styles-tokyo-bay"         = "雅高集团设计饭店"
  "mystays-shin-urayasu"          = "价位稳定实惠"
  "flexstay-shin-urayasu"         = "每间客房带小厨房·适合长住"
  "henna-hotel-maihama"           = "舞滨站班车（2026年7月起减班）"
  "four-stories-hotel"            = "巴士接驳（末班23:00）"
  "hiyori-hotel-maihama"          = "每间客房备足部按摩与烘鞋机"
  "viewfort-urayasu"              = "距浦安站步行1分钟·自助早餐"
  "hotel-daigo-urayasu"           = "全年统一房价·旺季不涨"
  "bayhotel-urayasu"              = "每间客房带厨房·冰箱与洗衣机"
  "urayasu-sun-hotel"             = "免费早餐·24小时前台"
  "premium-monday-maihama-view-1" = "2025年12月开业·免费迪士尼班车"
  "grand-monday-resort-maihama"   = "2026年7月18日开业·全客房面海·全年泳池"
  "hotel-seaside-edogawa"         = "位于葛西临海公园·步行3分钟·有榻榻米房"
  "cvs-bay-hotel"                 = "紧邻市川盐浜站·到舞滨2站"
  "hotel-ilfiore-kasai"           = "距葛西站步行3分钟·最多5人"
  "hotel-ilfiore-kasai-annex"     = "距葛西站步行3分钟·Il Fiore别馆"
  "hotel-lumiere-kasai"           = "商务饭店·距葛西站步行2分钟"
  "livemax-kasai-ekimae"          = "距葛西站步行3分钟·乘巴士约20分钟到迪士尼"
  "superhotel-myoden"             = "妙典站旁·乘东西线可达浦安"
}

# 特徴ラベルの韓国語訳（slug→한국어）。韓国語サイト(/ko/)の一覧・比較マップ用。
$featureKo = @{
  "tdl-hotel"                     = "디즈니랜드까지 도보 1분"
  "miracosta"                     = "디즈니씨 파크 내·전용 입구"
  "fantasy-springs-hotel"         = "디즈니씨 판타지 스프링스 직결(2024년 개업)"
  "ambassador-hotel"              = "마이하마역에서 도보 8분"
  "toy-story-hotel"               = "베이사이드 스테이션에서 도보 3분"
  "celebration-wish"              = "해피 엔트리 입장 특전 포함"
  "celebration-discover"          = "해피 엔트리 입장 특전 포함"
  "hotel-okura-tokyo-bay"         = "전용 파크 셔틀버스"
  "grand-nikko-tokyo-bay"         = "전용 파크 셔틀버스"
  "sheraton-grande-tokyo-bay"     = "대욕장과 대형 수영장"
  "hilton-tokyo-bay"              = "관내 24시간 편의점"
  "maihama-hotel-first-resort"    = "관내 셀프 세탁"
  "dreamgate-maihama"             = "JR 마이하마역 개찰구 직결"
  "maihama-view-hotel"            = "대욕장 'Spa Rose'"
  "royal-park-maihama"            = "2026년 2월 개업·최대 6인 투숙"
  "mystays-maihama"               = "디즈니씨까지 도보 6분·지역 내 가성비"
  "maihama-eurasia"               = "천연 온천·노천탕과 사우나"
  "eurasia-annex"                 = "본관 온천 할인 이용 가능"
  "hyatt-regency-tokyo-bay"       = "호텔 앞 공항버스 정류장(2024 신설)"
  "comfort-suites-tokyo-bay"      = "폐장 30분 후 셔틀·어린이 무료 동반"
  "brighton-tokyo-bay"            = "신우라야스역 직결"
  "oriental-tokyo-bay"            = "신우라야스역 직결"
  "emion-tokyo-bay"               = "천연 온천과 노천탕"
  "mitsui-garden-prana"           = "전망 대욕장과 관내 상점"
  "hoshinoresorts-1955-tokyo-bay" = "관내 로손 편의점·2024 개업"
  "lagent-tokyo-bay"              = "최대 6인·옆 건물 24시간 편의점"
  "ibis-styles-tokyo-bay"         = "아코르 그룹 디자인 호텔"
  "mystays-shin-urayasu"          = "안정적인 저렴한 가격"
  "flexstay-shin-urayasu"         = "전 객실 미니 주방·장기 체류에 적합"
  "henna-hotel-maihama"           = "마이하마역 셔틀(2026년 7월부터 감축)"
  "four-stories-hotel"            = "버스 접근(막차 23:00)"
  "hiyori-hotel-maihama"          = "전 객실 발 마사지기·신발 건조기 비치"
  "viewfort-urayasu"              = "우라야스역에서 도보 1분·뷔페 조식"
  "hotel-daigo-urayasu"           = "연중 균일 요금·성수기 인상 없음"
  "bayhotel-urayasu"              = "전 객실 주방·냉장고·세탁기"
  "urayasu-sun-hotel"             = "무료 조식·24시간 프런트"
  "premium-monday-maihama-view-1" = "2025년 12월 개업·무료 디즈니 셔틀"
  "grand-monday-resort-maihama"   = "2026년 7월 18일 개업·전 객실 오션프런트·연중 수영장"
  "hotel-seaside-edogawa"         = "가사이 임해공원 내·도보 3분·다다미 객실"
  "cvs-bay-hotel"                 = "이치카와시오하마역 인접·마이하마까지 2개 역"
  "hotel-ilfiore-kasai"           = "가사이역에서 도보 3분·최대 5인"
  "hotel-ilfiore-kasai-annex"     = "가사이역에서 도보 3분·Il Fiore 별관"
  "hotel-lumiere-kasai"           = "비즈니스 호텔·가사이역에서 도보 2분"
  "livemax-kasai-ekimae"          = "가사이역에서 도보 3분·버스로 디즈니까지 약 20분"
  "superhotel-myoden"             = "묘덴역 옆·도자이선으로 우라야스 도달"
}

# 特徴ラベルの繁体字訳（slug→繁體中文・台湾語彙）。繁体字サイト(/zh-tw/)の一覧・比較マップ用。
$featureZhTw = @{
  "tdl-hotel"                     = "步行1分鐘到迪士尼樂園"
  "miracosta"                     = "位於迪士尼海洋園區內·專用入口"
  "fantasy-springs-hotel"         = "直通迪士尼海洋夢幻泉鄉（2024年開幕）"
  "ambassador-hotel"              = "距舞濱站步行8分鐘"
  "toy-story-hotel"               = "距海灣站步行3分鐘"
  "celebration-wish"              = "含Happy Entry提前入園禮遇"
  "celebration-discover"          = "含Happy Entry提前入園禮遇"
  "hotel-okura-tokyo-bay"         = "專用樂園班車"
  "grand-nikko-tokyo-bay"         = "專用樂園班車"
  "sheraton-grande-tokyo-bay"     = "大浴場與大型泳池"
  "hilton-tokyo-bay"              = "館內24小時便利店"
  "maihama-hotel-first-resort"    = "館內自助洗衣"
  "dreamgate-maihama"             = "直通JR舞濱站剪票口"
  "maihama-view-hotel"            = "大浴場「Spa Rose」"
  "royal-park-maihama"            = "2026年2月開幕·最多入住6人"
  "mystays-maihama"               = "步行6分鐘到迪士尼海洋·區域內超值"
  "maihama-eurasia"               = "天然溫泉·露天浴池與三溫暖"
  "eurasia-annex"                 = "可優惠使用本館溫泉"
  "hyatt-regency-tokyo-bay"       = "飯店門口設機場巴士站（2024新設）"
  "comfort-suites-tokyo-bay"      = "閉園後30分鐘班車·兒童免費同住"
  "brighton-tokyo-bay"            = "直通新浦安站"
  "oriental-tokyo-bay"            = "直通新浦安站"
  "emion-tokyo-bay"               = "天然溫泉與露天浴池"
  "mitsui-garden-prana"           = "景觀大浴場與館內商店"
  "hoshinoresorts-1955-tokyo-bay" = "館內羅森便利店·2024開幕"
  "lagent-tokyo-bay"              = "最多6人·隔壁24小時便利店"
  "ibis-styles-tokyo-bay"         = "雅高集團設計飯店"
  "mystays-shin-urayasu"          = "價位穩定實惠"
  "flexstay-shin-urayasu"         = "每間客房附小廚房·適合長住"
  "henna-hotel-maihama"           = "舞濱站班車（2026年7月起減班）"
  "four-stories-hotel"            = "巴士接駁（末班23:00）"
  "hiyori-hotel-maihama"          = "每間客房備有足部按摩與烘鞋機"
  "viewfort-urayasu"              = "距浦安站步行1分鐘·自助早餐"
  "hotel-daigo-urayasu"           = "全年統一房價·旺季不漲"
  "bayhotel-urayasu"              = "每間客房附廚房·冰箱與洗衣機"
  "urayasu-sun-hotel"             = "免費早餐·24小時櫃檯"
  "premium-monday-maihama-view-1" = "2025年12月開幕·免費迪士尼班車"
  "grand-monday-resort-maihama"   = "2026年7月18日開幕·全客房面海·全年泳池"
  "hotel-seaside-edogawa"         = "位於葛西臨海公園·步行3分鐘·有榻榻米房"
  "cvs-bay-hotel"                 = "緊鄰市川鹽濱站·到舞濱2站"
  "hotel-ilfiore-kasai"           = "距葛西站步行3分鐘·最多5人"
  "hotel-ilfiore-kasai-annex"     = "距葛西站步行3分鐘·Il Fiore別館"
  "hotel-lumiere-kasai"           = "商務飯店·距葛西站步行2分鐘"
  "livemax-kasai-ekimae"          = "距葛西站步行3分鐘·搭巴士約20分鐘到迪士尼"
  "superhotel-myoden"             = "妙典站旁·搭東西線可達浦安"
}

# ホテル名の中文表記（slug→简体中文）。ディズニー直営は東京ディズニー公式简体中文サイト(/sc/)の官方名称、
# チェーン系は各ブランドの標準中文名、その他は一般的な表記。空はdispName(日本語名)で代替。
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
  "grand-monday-resort-maihama"   = "GRAND MONday Resort 东京湾舞滨"
  "hotel-seaside-edogawa"         = "江户川海滨酒店"
  "cvs-bay-hotel"                 = "CVS·BAY HOTEL"
  "hotel-ilfiore-kasai"           = "葛西菲奥雷酒店"
  "hotel-ilfiore-kasai-annex"     = "葛西菲奥雷酒店 ANNEX"
  "hotel-lumiere-kasai"           = "葛西卢米埃尔酒店"
  "livemax-kasai-ekimae"          = "LiVEMAX葛西站前酒店"
  "superhotel-myoden"             = "超级酒店 东西线·市川·妙典站前"
}

# ホテル名の韓国語表記（slug→한국어）。ディズニー直営は東京ディズニー公式韓国語サイト(/kr/)の公式名称、
# チェーン系は各ブランドの標準韓国語名、その他は一般的な音訳。空はdispName(日本語名)で代替。
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
  "grand-monday-resort-maihama"   = "GRAND MONday Resort 도쿄 베이 마이하마"
  "hotel-seaside-edogawa"         = "호텔 시사이드 에도가와"
  "cvs-bay-hotel"                 = "CVS·BAY HOTEL"
  "hotel-ilfiore-kasai"           = "호텔 일 피오레 가사이"
  "hotel-ilfiore-kasai-annex"     = "호텔 일 피오레 가사이 ANNEX"
  "hotel-lumiere-kasai"           = "호텔 뤼미에르 가사이"
  "livemax-kasai-ekimae"          = "호텔 리브맥스 가사이역앞"
  "superhotel-myoden"             = "슈퍼호텔 도자이선·이치카와·묘덴역앞"
}

# ホテル名の繁体字表記（slug→繁體中文・台湾語彙）。ディズニー直営は東京ディズニー公式繁体字サイト(/tc/)の官方名称、
# チェーン系は簡体字版を繁体字に変換した表記、その他は一般的な表記。空はdispName(日本語名)で代替。
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
  "grand-monday-resort-maihama"   = "GRAND MONday Resort 東京灣舞濱"
  "hotel-seaside-edogawa"         = "江戶川海濱飯店"
  "cvs-bay-hotel"                 = "CVS·BAY HOTEL"
  "hotel-ilfiore-kasai"           = "葛西菲奧雷飯店"
  "hotel-ilfiore-kasai-annex"     = "葛西菲奧雷飯店 ANNEX"
  "hotel-lumiere-kasai"           = "葛西盧米埃爾飯店"
  "livemax-kasai-ekimae"          = "LiVEMAX葛西站前飯店"
  "superhotel-myoden"             = "超級飯店 東西線·市川·妙典站前"
}

# CSVカテゴリ → 表示用カテゴリ（TDR公式の区分に準拠）
#   ディズニーホテル / オフィシャルホテル / パートナーホテル / グッドネイバーホテル / その他のホテル
#   ファッションホテルは区分を表示せず「—」（名称・エリアのみ掲載の方針）
$catMap = @{
  "ディズニーホテル"     = "ディズニーホテル"
  "オフィシャルホテル"   = "オフィシャルホテル"
  "パートナーホテル"     = "パートナーホテル"
  "グッドネイバーホテル" = "グッドネイバーホテル"
  "その他のホテル"       = "その他のホテル"
  "ファッションホテル"   = "—"
}

function Convert-Category($r) {
  $c = $r."カテゴリ"
  if ($catMap.ContainsKey($c)) { return $catMap[$c] }
  return $c
}
function Convert-Price($r) {
  $pm = ($r."最低価格").Trim()
  if ($pm -match '^\d+$' -and [int]$pm -gt 0) { return ("¥{0:N0}〜" -f [int]$pm) }
  return ""
}
function Convert-Policy($r) {
  if ($r."掲載区分" -eq "名称・カテゴリのみ掲載") { return "name-only" }
  return "normal"
}
# シャトル種別（CSV「シャトル種別」列）。統制語彙 walk/bayside/partner/own/none/空。
# shuttle(bool) は無料シャトルを実際に持つ種別（bayside/partner/own）で true。
function Convert-ShuttleType($r) {
  $t = ($r."シャトル種別").Trim()
  return $t
}
function Convert-PriceMin($r) {
  $pm = ($r."最低価格").Trim()
  if ($pm -match '^\d+$' -and [int]$pm -gt 0) { return [int]$pm }
  return 0
}
# 休館まで（CSV「休館まで」列）。値がある間は一時休館の再開予定日（YYYY-MM-DD）。空=通常営業。
function Convert-ClosedUntil($r) {
  return ($r."休館まで").Trim()
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# === 自動生成ファイル / DO NOT EDIT ===")
[void]$sb.AppendLine("# マスター: hotel-database-full.csv")
[void]$sb.AppendLine("# 生成:     scripts/build-hotels.ps1")
[void]$sb.AppendLine("# 区分・カテゴリ・特徴・価格を変えるときはCSVを編集して本スクリプトで再生成すること。")
[void]$sb.AppendLine("# policy: normal | name-only（名称・カテゴリのみ掲載）")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("areas:")

foreach ($a in $areas) {
  if ($a.id -ne "a") { [void]$sb.AppendLine("") }
  $rows = @($csv | Where-Object { $_."エリア記号" -eq $a.tag })
  [void]$sb.AppendLine(("  - id: {0}" -f $a.id))
  [void]$sb.AppendLine(("    tag: ""{0}""" -f $a.tag))
  [void]$sb.AppendLine(("    name: ""{0}""" -f $a.name))
  [void]$sb.AppendLine(("    name_en: ""{0}""" -f $a.name_en))
  [void]$sb.AppendLine(("    name_zh: ""{0}""" -f $a.name_zh))
  [void]$sb.AppendLine(("    name_ko: ""{0}""" -f $a.name_ko))
  [void]$sb.AppendLine(("    name_zh-tw: ""{0}""" -f $a.'name_zh-tw'))
  [void]$sb.AppendLine(("    group: ""{0}""" -f $a.group))
  [void]$sb.AppendLine(("    count: {0}" -f $rows.Count))
  [void]$sb.AppendLine(("    note: ""{0}""" -f $a.note))
  [void]$sb.AppendLine(("    note_en: ""{0}""" -f $a.note_en))
  [void]$sb.AppendLine(("    note_zh: ""{0}""" -f $a.note_zh))
  [void]$sb.AppendLine(("    note_ko: ""{0}""" -f $a.note_ko))
  [void]$sb.AppendLine(("    note_zh-tw: ""{0}""" -f $a.'note_zh-tw'))
  [void]$sb.AppendLine("    hotels:")
  foreach ($r in $rows) {
    $pol = Convert-Policy $r
    $ip  = "true"
    if ($pol -eq "name-only") { $ip = "false" }
    $dispName = ($r."表示名").Trim()
    if (-not $dispName) { $dispName = $r."施設名" }
    $nameEn = ($r."英語表記").Trim()
    if (-not $nameEn) { $nameEn = $dispName }
    $featEn = ""
    if ($r.slug -and $featureEn.ContainsKey($r.slug)) { $featEn = $featureEn[$r.slug] }
    $nameZhV = ""
    if ($r.slug -and $nameZh.ContainsKey($r.slug)) { $nameZhV = $nameZh[$r.slug] }
    if (-not $nameZhV) { $nameZhV = $dispName }
    $featZh = ""
    if ($r.slug -and $featureZh.ContainsKey($r.slug)) { $featZh = $featureZh[$r.slug] }
    $nameKoV = ""
    if ($r.slug -and $nameKo.ContainsKey($r.slug)) { $nameKoV = $nameKo[$r.slug] }
    if (-not $nameKoV) { $nameKoV = $dispName }
    $featKo = ""
    if ($r.slug -and $featureKo.ContainsKey($r.slug)) { $featKo = $featureKo[$r.slug] }
    $nameZhTwV = ""
    if ($r.slug -and $nameZhTw.ContainsKey($r.slug)) { $nameZhTwV = $nameZhTw[$r.slug] }
    if (-not $nameZhTwV) { $nameZhTwV = $dispName }
    $featZhTw = ""
    if ($r.slug -and $featureZhTw.ContainsKey($r.slug)) { $featZhTw = $featureZhTw[$r.slug] }
    [void]$sb.AppendLine(("      - name: ""{0}""" -f $dispName))
    [void]$sb.AppendLine(("        name_en: ""{0}""" -f $nameEn))
    [void]$sb.AppendLine(("        name_zh: ""{0}""" -f $nameZhV))
    [void]$sb.AppendLine(("        name_ko: ""{0}""" -f $nameKoV))
    [void]$sb.AppendLine(("        name_zh-tw: ""{0}""" -f $nameZhTwV))
    [void]$sb.AppendLine(("        category: ""{0}""" -f (Convert-Category $r)))
    [void]$sb.AppendLine(("        price_guide: ""{0}""" -f (Convert-Price $r)))
    [void]$sb.AppendLine(("        feature: ""{0}""" -f $r."特徴ラベル"))
    [void]$sb.AppendLine(("        feature_en: ""{0}""" -f $featEn))
    [void]$sb.AppendLine(("        feature_zh: ""{0}""" -f $featZh))
    [void]$sb.AppendLine(("        feature_ko: ""{0}""" -f $featKo))
    [void]$sb.AppendLine(("        feature_zh-tw: ""{0}""" -f $featZhTw))
    $stype = Convert-ShuttleType $r
    $shasBool = "false"
    if ($stype -eq "bayside" -or $stype -eq "partner" -or $stype -eq "own") { $shasBool = "true" }
    [void]$sb.AppendLine(("        shuttle_type: ""{0}""" -f $stype))
    [void]$sb.AppendLine(("        shuttle: {0}" -f $shasBool))
    [void]$sb.AppendLine(("        price_min: {0}" -f (Convert-PriceMin $r)))
    $closedUntil = Convert-ClosedUntil $r
    if ($closedUntil) { [void]$sb.AppendLine(("        closed_until: ""{0}""" -f $closedUntil)) }
    [void]$sb.AppendLine(("        policy: {0}" -f $pol))
    [void]$sb.AppendLine(("        individual_page: {0}" -f $ip))
    if ($pol -ne "name-only") {
      [void]$sb.AppendLine(("        slug: ""{0}""" -f $r.slug))
    }
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), $utf8NoBom)
Write-Output "生成完了: $outPath"
Write-Output ("エリア数: {0} / ホテル総数: {1}" -f $areas.Count, $csv.Count)
