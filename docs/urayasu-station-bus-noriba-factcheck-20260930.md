# 浦安駅バス乗り場ガイド 一次情報照合記録

確認日：2026-09-30（JST）／対象：PR #1、claude/urayasu-station-bus-guide-vwsd3q

## 作業A：照合結果（修正前の記事を基準）

事業者の現行検索は京成サイトが直接リンクする「京成バスナビ」。NAVITIMEの一般向け乗換案内ではなく、事業者提供の時刻表・乗り場・区間運賃として照合した。

| 項目 | 記事の記載 | 一次情報の記載（出典URL） | 判定：一致／不一致／確認できず |
|---|---|---|---|
| Aの対応 | 6、市役所前・東海大浦安高校入口経由 舞浜駅 | 現行公式一覧のAに6系統・同経由の舞浜駅行き。[京成公式一覧](https://transfer-cloud.navitime.biz/keiseibus-group/courses?busstop=00020739) | 一致 |
| Bの2系統 | 2、新浦安駅北口経由 舞浜駅 | Bに2系統、新浦安駅北口・順天堂病院前経由 舞浜駅行き。別の時刻表ページでも乗り場はB。[京成公式一覧](https://transfer-cloud.navitime.biz/keiseibus-group/courses?busstop=00020739) | 一致 |
| Bの3・11・18 | 3は総合公園、11は総合公園・日の出南、18は高洲海浜公園 | Bに3・11・18を掲載。経由地・行き先は記事と整合。[京成公式一覧](https://transfer-cloud.navitime.biz/keiseibus-group/courses?busstop=00020739) | 一致 |
| Dの4・12 | 4は舞浜駅・ランド、12は舞浜駅 | Dに4・12。4には舞浜駅・ランド・千鳥車庫の便、12はシー・リゾートホテル経由の舞浜駅行き。[京成公式時刻表](https://transfer-cloud.navitime.biz/keiseibus-group/courses/timetables?busstop=00020739&course-sequence=0008200222-1) | 一致（行き先・運行日の補足を追加） |
| Eの5・9 | 5は堀江六丁目・東野中央経由 新浦安駅、9は堀江六丁目・富士見三丁目経由 舞浜駅 | Eに5・9。9には京成ローズタウン止まりもある。[京成公式一覧](https://transfer-cloud.navitime.biz/keiseibus-group/courses?busstop=00020739) | 一致 |
| A・Bの場所 | やなぎ通り沿いで並ぶ | 配置図では北側、Bが西、Aが東。[市まちづくりだより第5号・配置図](https://www.city.urayasu.lg.jp/_res/projects/default_project/_page_/001/047/342/05.pdf) | 一致 |
| Dの所在 | 歩道橋の先 | やなぎ通り南側・浦安駅第4自転車駐車場前。配置図に浦安駅前歩道橋も描かれる。[市配置図](https://www.city.urayasu.lg.jp/_res/projects/default_project/_page_/001/047/342/05.pdf) | 一致（所在） |
| Dの細かな道順 | 緑色の歩道橋・左の階段の正面 | 色と階段の左右を裏付ける案内は取得できなかった。[市配置図](https://www.city.urayasu.lg.jp/_res/projects/default_project/_page_/001/047/342/05.pdf) | 確認できず（色・左右を削除） |
| Eの所在 | 宮前通り沿い | 宮前通り、やなぎ通りとの交差点の南側。[市配置図](https://www.city.urayasu.lg.jp/_res/projects/default_project/_page_/001/047/342/05.pdf) | 一致 |
| Eの徒歩時間 | 約5分 | 一次情報に所要時間の明記を確認できなかった。配置図から時間を推算しない。 | 確認できず（削除） |
| 現在の乗車場／C | A・B・D・Eの4か所 | 現行京成一覧はA・B・D・E、市配置図も同じ4か所。降車場は1・2・3で、C表記ではない。[京成一覧](https://transfer-cloud.navitime.biz/keiseibus-group/courses?busstop=00020739)、[市配置図](https://www.city.urayasu.lg.jp/_res/projects/default_project/_page_/001/047/342/05.pdf) | 一致（現在の配置）。Cが使われなくなった歴史・理由は確認できず、本文に推測を書かない |
| 1系統の乗車位置 | 浦安駅東口、入口での記号なし | 浦安駅東口の公式乗車案内は02。浦安駅入口のA・B・D・Eの発車一覧には1を掲載していない。[東口公式一覧](https://transfer-cloud.navitime.biz/keiseibus-group/courses?busstop=00020740)、[入口公式一覧](https://transfer-cloud.navitime.biz/keiseibus-group/courses?busstop=00020739) | 一致（東口に02を追記。入口に記号を割り当てない） |
| 1系統の医療センター経由 | 医療センター・北栄二丁目・美浜中学校を経由 | 無印は北栄二丁目・美浜中学校経由、「医療」は医療センター経由。「浦」は入口行き。[東口公式時刻表](https://transfer-cloud.navitime.biz/keiseibus-group/courses/timetables?busstop=00020740&course-sequence=0008200202-18) | 不一致（全便が医療センター経由のように読めるため修正） |
| 37系統 | 浦安駅入口経由で舞浜・シー／帰路も37を推奨 | 路線図では南行徳駅から北栄四丁目・豊受神社・堀江六丁目方面へ向かい、浦安駅入口を通らない。入口の発車一覧にも37なし。[公式路線図](https://www.keiseibus.co.jp/wp-content/uploads/2026/02/routemap-chidori.pdf)、[入口公式一覧](https://transfer-cloud.navitime.biz/keiseibus-group/courses?busstop=00020739) | 不一致（駅からの往復案内から除外） |
| 降車場の数・位置 | 降車専用あり、降りると駅はすぐ | 市図で降車場1・2・3。1は南側のA・B付近、2は南側のDより西、3は北側のD対向付近。「すぐ」の歩行時間までは裏付けなし。[市配置図](https://www.city.urayasu.lg.jp/_res/projects/default_project/_page_/001/047/342/05.pdf) | 一致（専用降車場あり）。数・位置を追記、「すぐ」は削除 |
| 9の深夜便 | E発、ローズタウン止まり、運賃倍額 | E時刻表の★ロが深夜・ローズタウン行き・倍額。平日23:41、土曜23:25、日曜祝日は★の便なし（2026-09-30閲覧）。固定時刻は本文に置かない。[9公式時刻表](https://transfer-cloud.navitime.biz/keiseibus-group/courses/timetables?busstop=00020739&course-sequence=0008200244-1) | 一致 |
| 9の運賃・所要時間 | 210円・約20分 | 確認便6:10発→舞浜駅南口6:29着、210円。19分は約20分の目安と整合。[9公式通過時刻表](https://transfer-cloud.navitime.biz/keiseibus-group/courses/timetables/81750006/stops?departure-busstop=00020739-1&course=0008200244&datetime=2026-09-30T06:10:00%2B09:00) | 一致（便・道路状況で変動） |
| 2の運賃・所要時間 | 280円・約25分 | 確認便6:17発→舞浜駅南口6:43着、280円。26分は約25分の概数として扱い、固定所要時間とはしない。[2公式通過時刻表](https://transfer-cloud.navitime.biz/keiseibus-group/courses/timetables/810b000f/stops?course=0008200206&datetime=2026-09-29T06:17:00%2B09:00&departure-busstop=00020739-1) | 一致（概数。確認便は26分） |
| おさんぽバスの場所・運賃 | 路線バスとは別、店を過ぎ横断歩道手前を左、100円 | 文化会館の写真案内が道順と一律100円を記載。これは新浦安駅行きの乗り場。逆方向は市の停留所マップで案内。[文化会館公式](https://www.urayasu-zaidan.or.jp/urayasu-bunka/1004543.html)、[市路線図・時刻表](https://www.city.urayasu.lg.jp/todokede/machi/bus/1046220.html) | 一致（新浦安駅行きと明記） |
| おさんぽバス徒歩時間 | 約3分 | 一次情報に徒歩3分の明記を確認できなかった。 | 確認できず（削除） |
| 移転の方向性 | Eをやなぎ通りへ集約 | 第5号に、まずEをやなぎ通り南側街区の市有地へ集約する方向性。[市第5号](https://www.city.urayasu.lg.jp/_res/projects/default_project/_page_/001/047/342/05.pdf) | 一致 |
| 移転の具体的計画 | 2031年度、3台分、屋根、A・Bなど対象外 | 提示された意見募集ページと素案PDFは404。現存の事業ページ・第5号では当該目標年度や寸法・設備を照合できなかった。[市事業ページ](https://www.city.urayasu.lg.jp/shisei/machi/torikumi/1047327/1047421.html)、旧資料：https://www.city.urayasu.lg.jp/_res/projects/default_project/_page_/001/048/537/kihonkeikakusoan.pdf | 確認できず（新記事とリンク先ニュースの現行案内から取り下げ） |

## 作業B：反映した修正

- A・B・D・Eの対応は保持。舞浜方面にBの2系統を加え、冒頭ボタン・description・本文表・FAQを同期。
- 1系統の浦安駅東口02と、医療センター経由便の見分け方を追加。37系統を浦安駅入口発着として推奨する記述を訂正。
- 12系統のシー・ホテル経由、4系統の千鳥車庫行き、9系統の通常ローズタウン止まりも補足。
- Dの色・階段の左右、Eの徒歩5分、おさんぽバスの徒歩3分、降車後の「すぐ」、未裏付けの距離を除去。所在地・経路は公式図で案内。
- 降車場1・2・3の所在を追加。Cの歴史的理由は推測しない。
- 旧事業者URLを現行公式に差し替え、問い合わせ先を現行の営業所一覧で確認（050-1809-3651、9:00〜19:00）。
- 移転先の方向性だけを現行一次情報から掲載。2031年度・3台分・屋根などの記述を新記事と関連ニュースで揃えて削除。ニュースの公開日・slugは保持。
- ホテルaccess.mdのDの場所を修正。keiyo-line-unko-joho.mdの9=E、lifeguides.yamlのA・B・D・Eは一致しており変更不要。
- local_busの料金・時間の値は保持し、公式時刻表の出典URL・確認日・確認便をコメントへ追記。変更した記事のlastmodは2026-09-30、dateは保持。

## 作業C：公開条件

公開案内に残る乗車場と系統の対応は、入口A=6／B=2・3・11・18／D=4・12／E=5・9、東口02=1。すべて現行の事業者案内で確認できた。37は入口を経由しないため該当しない。

確認できなかった徒歩時間・移転の詳細は公開文から除去した。Cの過去の理由は現在の乗り場対応を左右せず、推測も掲載しない。ビルド・内部リンク確認が通れば、依頼で定められた公開条件を満たす。

検証結果（2026-09-30）：

- `hugo --minify --cleanDestinationDir` 成功。テーマ等の既存の非推奨警告のみ。
- リポジトリの内部リンク検査：3,922種類、実害のあるリンク切れ0（JavaScript内の未展開変数による誤検出1）。
- 新記事と関連記事6ページ：内部リンク490件を、ページ内アンカーを含めて検査し、リンク切れ0。
- FAQ本文6件・frontmatter・生成されたFAQPage JSON-LDの回答が一致。
- 変更記事3ファイルのlastmod=2026-09-30、元のdate保持を機械確認。
- `git diff --check` 成功。

以上により、修正済みの記事は公開可と判断する。
