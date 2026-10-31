/* /events/ の開催日の絞り込み「すべて／今日／今週末／今月」（工程5B-1。layouts/_default/events.html から読み込む）
   - 今日は日本時間（Asia/Tokyo）の日付。閲覧者の端末のタイムゾーンに左右されない（UTC に9時間を足して日付を取る。日本に夏時間はない）
   - 各行の data-spans（event-dates の groups。「開始/終了」を空白区切り）と data-open（終了日未定）で判定する。
     判定する期間と1日でも重なる日程があれば表示する。終了日未定は開始日以降ずっと開催中とみなす
   - 今週末は土日（今日が土曜ならその土日、日曜なら今日だけ、平日なら次の土日）。祝日は含めない
   - 今月は今日から月末まで
   - ?when=today|weekend|month で状態を復元・共有できる。それ以外の値は「すべて」
   - JS が動かないときはボタンを出さず全件を表示したまま（ボタンは hidden で出力している）
   - GA4 の event_filter はボタンを押したときだけ送る（URL からの復元では送らない）。gtag が無い環境（本番以外）では送らない
   判定の関数は EvFilter として外に出している（scripts/validate/test/events-hugo.mjs がページなしで呼ぶ） */
var EvFilter = (function () {
  'use strict';
  var WHENS = ['all', 'today', 'weekend', 'month'];
  var WDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function toDate(s) { var a = s.split('-'); return new Date(Date.UTC(+a[0], +a[1] - 1, +a[2])); }
  function addDays(s, n) { var d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); }

  /* 日本時間の日付（YYYY-MM-DD） */
  function jstToday(date) { return ymd(new Date(date.getTime() + 9 * 3600 * 1000)); }

  /* 判定する期間 [開始, 終了]（YYYY-MM-DD）。「すべて」は null */
  function range(when, today) {
    if (when === 'today') return [today, today];
    if (when === 'weekend') {
      var w = toDate(today).getUTCDay();
      if (w === 0) return [today, today];
      if (w === 6) return [today, addDays(today, 1)];
      return [addDays(today, 6 - w), addDays(today, 7 - w)];
    }
    if (when === 'month') {
      var d = toDate(today);
      return [today, ymd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))];
    }
    return null;
  }

  /* data-spans を読む。書式に合わない値は使わない */
  function parseSpans(attr) {
    var out = [];
    (attr || '').split(' ').forEach(function (p) {
      var m = /^(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/.exec(p);
      if (m && m[1] <= m[2]) out.push({ start: m[1], end: m[2] });
    });
    return out;
  }

  function matches(spans, open, r) {
    if (!r) return true;
    return spans.some(function (s) { return s.start <= r[1] && (open || s.end >= r[0]); });
  }

  function label(s) {
    var d = toDate(s);
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '(' + WDAYS[d.getUTCDay()] + ')';
  }

  var NAMES = { today: '今日', weekend: '今週末', month: '今月' };
  var rows, list, buttons, status, empty;

  function apply(when, byUser) {
    var r = range(when, jstToday(new Date()));
    var n = 0;
    Array.prototype.forEach.call(rows, function (row) {
      var ok = matches(parseSpans(row.getAttribute('data-spans')), row.hasAttribute('data-open'), r);
      row.hidden = !ok;
      if (ok) n++;
    });
    /* 表示する行が無い見出し（開催中・○年○月）は、その一覧ごと隠す */
    Array.prototype.forEach.call(list.querySelectorAll('.ev-group'), function (g) {
      var any = !!g.querySelector('.ev-row:not([hidden])');
      g.hidden = !any;
      var h = g.previousElementSibling;
      if (h && h.classList.contains('ev-month')) h.hidden = !any;
    });
    Array.prototype.forEach.call(buttons, function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-when') === when ? 'true' : 'false');
    });
    if (r) {
      status.textContent = NAMES[when] + '（' + label(r[0]) + (r[1] !== r[0] ? '〜' + label(r[1]) : '') + '）に開催：' + n + '件';
    }
    status.hidden = !r;
    empty.hidden = !(r && n === 0);
    if (!byUser) return;
    var q = new URLSearchParams(location.search);
    if (when === 'all') q.delete('when'); else q.set('when', when);
    var qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    if (typeof gtag === 'function') {
      gtag('event', 'event_filter', { filter_type: 'when', filter_value: when, result_count: n });
    }
  }

  function init() {
    var box = document.querySelector('.ev-filter');
    list = document.querySelector('.ev-list');
    if (!box || !list) return;
    rows = list.querySelectorAll('.ev-row');
    buttons = box.querySelectorAll('.ev-filter-btn');
    status = document.querySelector('.ev-filter-status');
    empty = document.querySelector('.ev-filter-empty');
    var when = new URLSearchParams(location.search).get('when');
    if (WHENS.indexOf(when) < 0) when = 'all';
    box.hidden = false;
    apply(when, false);
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.ev-filter-btn, .ev-filter-reset') : null;
      if (b) apply(b.getAttribute('data-when'), true);
    });
  }

  return { WHENS: WHENS, jstToday: jstToday, range: range, parseSpans: parseSpans, matches: matches, init: init };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', EvFilter.init);
  else EvFilter.init();
}
