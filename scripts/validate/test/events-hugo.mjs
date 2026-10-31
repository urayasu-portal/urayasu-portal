#!/usr/bin/env node
/*
 * イベントカレンダー（/events/）と Event 構造化データのテスト（工程1a PR 4）。リポジトリ直下で実行:
 *   node scripts/validate/test/events-hugo.mjs            （hugo が PATH にある場合）
 *   HUGO=/path/to/hugo node scripts/validate/test/events-hugo.mjs
 * 一時ディレクトリに最小の Hugo サイトを作り、リポジトリの layouts/_default/events.html と関連 partial をそのまま使って
 * 約20通りの記事をビルドし、/events/ の掲載・区分・並び・表示と、各記事の Event JSON-LD を期待値と比べる。
 * 今日の日付に依存しないよう、過去は 2020 年、未来は 2099 年の日付を使う。依存ライブラリなし。失敗があれば終了コード 1。
 * 後半は判定する時刻を固定（site.Params.eventsNow）した別のサイトで、日本時間の日付の境目（0時・15時・23時59分、
 * UTC と日本時間で日付が違う時間帯、年の境目）と、残っている日程だけの要約を確かめる。環境変数 TZ を変えて同じ結果になることも見る
 * （TZ は Linux（GitHub Actions）で効く。Windows の Hugo は TZ を読まないが、判定は Asia/Tokyo への変換だけに依存する）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const ROOT = process.cwd();
const HUGO = process.env.HUGO || 'hugo';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'events-'));
const w = (rel, text) => { const p = path.join(DIR, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };

w('hugo.toml', 'baseURL = "https://example.test/"\ndefaultContentLanguage = "ja"\ndisableKinds = ["taxonomy", "term", "RSS", "sitemap", "robotsTXT", "404", "home", "section"]\n');
const PARTIALS = ['date-ymd.html', 'date-jst.html', 'event-dates.html', 'event-dates-text.html', 'event-calendar-eligible.html', 'event-calendar-status.html', 'event-jsonld-eligible.html', 'event-jsonld.html', 'ev-row.html'];
for (const f of PARTIALS) {
  w('layouts/partials/' + f, fs.readFileSync(path.join(ROOT, 'layouts/partials', f), 'utf8'));
}
w('layouts/partials/cover-image.html', '{{- return "" -}}\n'); // 画像は扱わない
w('layouts/_default/events.html', fs.readFileSync(path.join(ROOT, 'layouts/_default/events.html'), 'utf8'));
const FILTER_JS = fs.readFileSync(path.join(ROOT, 'assets/js/events-filter.js'), 'utf8');
w('assets/js/events-filter.js', FILTER_JS);
w('layouts/_default/baseof.html', '<html><body>{{ block "main" . }}{{ end }}</body></html>\n');
w('layouts/_default/single.html', '{{- define "main" }}<div id="jsonld">{{ partial "event-jsonld.html" . }}</div>{{ end }}\n');
w('content/events.md', '---\ntitle: "イベントカレンダー"\nlayout: "events"\n---\n本文\n');

// ---- テストケース ----
// cat: 1件目のカテゴリ。cal: /events/ の区分（ongoing/upcoming/past/none）。ld: JSON-LD の Event の [startDate, endDate] 一覧（[] は出さない）
const C = [];
const c = (slug, fm, expect, cat = 'イベント', title = '') => C.push({ slug, fm, expect, cat, title: title || slug });
const LOC = 'eventLocation: "テスト会場"';
c('single-future', 'eventDate: "2099-06-01"', { cal: 'upcoming', date: '6/1', ld: [] });
c('period-ongoing', 'eventDate: "2020-01-01/2099-12-31"\n' + LOC, { cal: 'ongoing', ld: [['2020-01-01', '2099-12-31']], loc: 'テスト会場', org: null });
c('period-ongoing-earlier-end', 'eventDate: "2020-01-01/2098-12-31"', { cal: 'ongoing', ld: [] });
c('dates-only', 'eventDates:\n  - "2099-03-01"\n  - "2099-03-08"\n' + LOC, { cal: 'upcoming', date: '3/1', summary: ['2099-03-01', '2099-03-08'], ld: [['2099-03-01', null], ['2099-03-08', null]], ids: true });
c('multi-session', 'eventDates:\n  - "2099-04-01/2099-04-03"\n  - "2099-05-01/2099-05-03"\n' + LOC, { cal: 'upcoming', date: '4/1', summary: ['2099-04-01', '2099-04-03', '2099-05-01', '2099-05-03'], ld: [['2099-04-01', '2099-04-03'], ['2099-05-01', '2099-05-03']] });
c('partly-past', 'eventDates:\n  - "2020-01-01"\n  - "2099-07-01"', { cal: 'upcoming', date: '7/1', summary: ['2099-07-01'], ld: [] });
// 今後の日程の要約は、終わった日程を含めない（開催中の会期は含める）
c('rest-three-of-five', 'eventDates:\n  - "2020-01-01"\n  - "2020-02-01"\n  - "2099-01-10"\n  - "2099-01-20"\n  - "2099-02-03"', { cal: 'upcoming', date: '1/10', summary: ['2099-01-10', '2099-01-20', '2099-02-03'], noMore: true, ld: [] });
c('rest-four-plus', 'eventDates:\n  - "2020-01-01"\n  - "2099-03-01"\n  - "2099-03-03"\n  - "2099-03-05"\n  - "2099-03-07"', { cal: 'upcoming', date: '3/1', summary: ['2099-03-01'], more: 'ほか全4日程', ld: [] });
c('rest-with-current-period', 'eventDates:\n  - "2020-01-01/2099-12-31"\n  - "2020-05-01"\n  - "2099-06-01"', { cal: 'ongoing', summary: ['2020-01-01', '2099-12-31', '2099-06-01'], ld: [] });
c('all-past', 'eventDate: "2020-02-01"', { cal: 'past', ld: [] });
c('ongoing-before', 'eventDate: "2099-08-01"\neventOngoing: true\n' + LOC, { cal: 'upcoming', date: '8/1', openEnd: true, ld: [['2099-08-01', null]] });
c('ongoing-after', 'eventDate: "2020-03-01"\neventOngoing: true\n' + LOC, { cal: 'ongoing', openEnd: true, ld: [['2020-03-01', null]] });
c('match-explicit', 'eventKind: "match"\neventDate: "2099-09-01"\n' + LOC, { cal: 'upcoming', kindBadge: true, ld: [['2099-09-01', null]] }, 'スポーツ');
c('fair-explicit', 'eventKind: "fair"\neventDate: "2099-09-02"\n' + LOC, { cal: 'none', ld: [] }, 'グルメ・カフェ');
c('legacy-sports', 'eventDate: "2099-09-03"\n' + LOC, { cal: 'none', ld: [] }, 'スポーツ');
c('legacy-kids', 'eventDate: "2099-09-04"\n' + LOC, { cal: 'none', ld: [] }, '子育て・教育');
c('calendar-true-fair', 'eventKind: "fair"\ncalendar: true\neventDate: "2099-09-05"\n' + LOC, { cal: 'upcoming', ld: [] }, 'グルメ・カフェ');
c('calendar-false-event', 'calendar: false\neventDate: "2099-09-06"\n' + LOC, { cal: 'none', ld: [['2099-09-06', null]] });
c('calendar-true-notable-only', 'calendar: true\nnotableDate: "2099-09-07"', { cal: 'none', ld: [] }, 'お知らせ');
c('invalid-date', 'eventDate: "2099-02-30"\n' + LOC, { cal: 'none', ld: [] });
c('organizer', 'eventDate: "2099-10-01"\n' + LOC + '\norganizer: "テスト実行委員会"', { cal: 'upcoming', ld: [['2099-10-01', null]], loc: 'テスト会場', org: 'テスト実行委員会' });
c('duplicate-schedule', 'eventDate: "2099-11-01"\neventDates:\n  - "2099-11-01"\n' + LOC, { cal: 'upcoming', ld: [['2099-11-01', null]] });
c('out-of-city-no-location', 'eventDate: "2099-11-02"', { cal: 'upcoming', ld: [] }, 'イベント', '【行徳】市外のイベント');
c('empty-location', 'eventDate: "2099-11-03"\neventLocation: ""', { cal: 'upcoming', ld: [] });
c('shop-open', 'eventDate: "2099-11-04"\n' + LOC, { cal: 'none', ld: [] }, '開店・閉店');
// 連続する単日だけの日程は1つの期間にまとまる（data-spans も groups と同じ1期間）
c('consecutive-days', 'eventDates:\n  - "2099-12-05"\n  - "2099-12-06"', { cal: 'upcoming', date: '12/5', ld: [] });

C.forEach((k) => {
  w('content/posts/' + k.slug + '.md', '---\ntitle: "' + k.title + '"\ndate: 2020-01-01T10:00:00+09:00\nslug: "' + k.slug + '"\ncategories:\n  - "' + k.cat + '"\n' + k.fm + '\nhideEventBox: true\n---\n本文\n');
});
const r = spawnSync(HUGO, ['--source', DIR, '--destination', path.join(DIR, 'public'), '--quiet'], { encoding: 'utf8' });
let pass = 0, fail = 0;
if (r.status !== 0) { console.log('  FAIL Hugo のビルドが失敗しました\n' + (r.stderr || r.stdout || r.error)); process.exit(1); }
console.log('  ok   ' + C.length + ' 本の記事（不正な値を含む）でビルドが成功'); pass++;

// ---- /events/ の解析 ----
const ev = fs.readFileSync(path.join(DIR, 'public/events/index.html'), 'utf8');
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const section = {}, rowText = {}, rowHtml = {}, rowAttr = {}, order = [];
let cur = '';
for (const m of ev.matchAll(/<h2 class="ev-month">([^<]*)<\/h2>|<a class="ev-row( is-past)?" href="\/posts\/([^/]+)\/"([^>]*)>([\s\S]*?)<\/a>/g)) {
  if (m[1] !== undefined) { cur = m[1] === '開催中' ? 'ongoing' : 'upcoming'; continue; }
  const slug = m[3];
  section[slug] = m[2] ? 'past' : cur; rowText[slug] = strip(m[5]); rowHtml[slug] = m[5]; rowAttr[slug] = m[4]; order.push(slug);
}
const itemList = (/"@type":"ItemList"[\s\S]*?<\/script>/.exec(ev) || [''])[0];

const errs = [];
const check = (name, fn) => { const e = []; fn(e); if (e.length) { fail++; console.log('  FAIL ' + name + '\n       ' + e.join('\n       ')); } else { pass++; console.log('  ok   ' + name); } };
for (const k of C) {
  check(k.slug, (e) => {
    const sec = section[k.slug] || 'none';
    if (sec !== k.expect.cal) e.push('/events/ の区分: 期待 ' + k.expect.cal + ' 実際 ' + sec);
    const t = rowText[k.slug] || '';
    if (k.expect.date && !t.startsWith(k.expect.date)) e.push('日付の列: 期待 ' + k.expect.date + ' で始まる 実際 ' + t.slice(0, 30));
    if (k.expect.summary) {
      const sched = (/<span class="ev-sched">今後の日程：([\s\S]*?)<\/span>/.exec(rowHtml[k.slug] || '') || [])[1];
      const dts = sched === undefined ? null : [...sched.matchAll(/datetime="([^"]+)"/g)].map((x) => x[1]);
      if (JSON.stringify(dts) !== JSON.stringify(k.expect.summary)) e.push('今後の日程の要約: 期待 ' + JSON.stringify(k.expect.summary) + ' 実際 ' + JSON.stringify(dts));
      if (k.expect.more && !strip(sched || '').endsWith(k.expect.more)) e.push('「' + k.expect.more + '」で終わっていない: ' + strip(sched || ''));
      if (k.expect.noMore && /ほか/.test(sched || '')) e.push('3日程以下なのに「ほか」がある');
    } else if (/今後の日程/.test(t)) e.push('要約が出ている（期待は無し）');
    if (k.expect.openEnd && !/終了日未定/.test(t)) e.push('「終了日未定」が無い');
    if (k.expect.kindBadge && !/試合/.test(t)) e.push('「試合」の表示が無い');
    const inList = itemList.includes('/posts/' + k.slug + '/');
    if (inList !== (sec === 'ongoing' || sec === 'upcoming')) e.push('ItemList の掲載が区分と合わない: ' + inList);
    // JSON-LD
    const page = fs.readFileSync(path.join(DIR, 'public/posts', k.slug, 'index.html'), 'utf8');
    const blocks = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((x) => x[1]);
    let events = [];
    for (const b of blocks) { let j; try { j = JSON.parse(b); } catch { e.push('JSON-LD が JSON として不正'); continue; } events = events.concat(Array.isArray(j) ? j : [j]); }
    events = events.filter((x) => x['@type'] === 'Event');
    const got = events.map((x) => [x.startDate, x.endDate || null]);
    if (JSON.stringify(got) !== JSON.stringify(k.expect.ld)) e.push('Event の日付: 期待 ' + JSON.stringify(k.expect.ld) + ' 実際 ' + JSON.stringify(got));
    for (const x of events) {
      if (!x.location || x.location.name !== 'テスト会場') e.push('location が eventLocation の値でない: ' + JSON.stringify(x.location));
      if (x.location && x.location.address) e.push('location に住所が出ている（既定値の住所は出さない）');
      if (k.expect.org === null && x.organizer) e.push('organizer が出ている（明示が無いのに）: ' + JSON.stringify(x.organizer));
      if (k.expect.org && (!x.organizer || x.organizer.name !== k.expect.org)) e.push('organizer: 期待 ' + k.expect.org);
      if (/浦安市|千葉県/.test(JSON.stringify(x))) e.push('既定値「浦安市」「千葉県」が出ている');
      if (/\//.test(x.startDate + (x.endDate || ''))) e.push('日付に生の値が出ている');
    }
    if (k.expect.ids && !(events.length > 1 && events.every((x, i) => x['@id'] === `https://example.test/posts/${k.slug}/#event-${i + 1}`))) e.push('複数 Event の @id が「記事URL#event-N」になっていない');
  });
}
check('開催中の並び: 終了日の近い順、終了日未定は最後', (e) => {
  const on = order.filter((s) => section[s] === 'ongoing');
  const want = ['period-ongoing-earlier-end', 'period-ongoing', 'rest-with-current-period', 'ongoing-after'];
  if (JSON.stringify(on) !== JSON.stringify(want)) e.push('期待 ' + want.join(', ') + ' 実際 ' + on.join(', '));
});
check('開催予定の並び: 次回の開催日順', (e) => {
  const up = order.filter((s) => section[s] === 'upcoming');
  const first = ['rest-three-of-five', 'dates-only', 'rest-four-plus', 'multi-session', 'single-future', 'partly-past', 'ongoing-before'];
  if (JSON.stringify(up.slice(0, first.length)) !== JSON.stringify(first)) e.push('期待 ' + first.join(', ') + ' … 実際 ' + up.slice(0, first.length).join(', '));
});

// ---- 開催日の絞り込み（工程5B-1） ----
// 判定の関数（assets/js/events-filter.js）をページなしで読み込む。document が無いので画面の処理は動かない
const F = (() => { const ctx = {}; vm.createContext(ctx); vm.runInContext(FILTER_JS, ctx); return ctx.EvFilter; })();
const attrOf = (slug, name) => (new RegExp(' ' + name + '="([^"]*)"').exec(rowAttr[slug] || '') || [])[1];
// data-spans は event-dates の groups と同じ（日付順・連続する単日は1期間）。終わった日程も含める（判定は JS で行う）
const SPANS = {
  'single-future': '2099-06-01/2099-06-01', 'period-ongoing': '2020-01-01/2099-12-31',
  'dates-only': '2099-03-01/2099-03-01 2099-03-08/2099-03-08', 'multi-session': '2099-04-01/2099-04-03 2099-05-01/2099-05-03',
  'rest-with-current-period': '2020-01-01/2099-12-31 2020-05-01/2020-05-01 2099-06-01/2099-06-01',
  'ongoing-before': '2099-08-01/2099-08-01', 'ongoing-after': '2020-03-01/2020-03-01', 'consecutive-days': '2099-12-05/2099-12-06',
};
check('data-spans: 掲載中の全行にあり、書式どおりで解釈できない値が0', (e) => {
  for (const s of order.filter((x) => section[x] !== 'past')) {
    const v = attrOf(s, 'data-spans');
    if (v === undefined) { e.push(s + ': data-spans が無い'); continue; }
    if (F.parseSpans(v).length !== v.split(' ').length) e.push(s + ': 解釈できない値がある: ' + v);
    const open = /data-open="1"/.test(rowAttr[s]);
    if (open !== !!(C.find((k) => k.slug === s) || { expect: {} }).expect.openEnd) e.push(s + ': data-open が終了日未定と合わない');
  }
  for (const s of order.filter((x) => section[x] === 'past')) if (/data-spans/.test(rowAttr[s])) e.push(s + ': 終了した行に data-spans がある');
});
check('data-spans: 日程が event-dates の groups と一致', (e) => {
  for (const [s, want] of Object.entries(SPANS)) if (attrOf(s, 'data-spans') !== want) e.push(s + ': 期待 ' + want + ' 実際 ' + attrOf(s, 'data-spans'));
});
check('絞り込みのボタン: JS 無効時は出さない（hidden）・4つの順番・初期は「すべて」', (e) => {
  const box = (/<div class="ev-filter"([^>]*)>([\s\S]*?)<\/div>/.exec(ev) || []);
  if (!box[0]) { e.push('.ev-filter が無い'); return; }
  if (!/ hidden/.test(box[1])) e.push('.ev-filter に hidden が無い（JS が動かないときもボタンが見える）');
  const whens = [...box[2].matchAll(/data-when="([^"]+)" aria-pressed="([^"]+)"/g)].map((m) => m[1] + ':' + m[2]);
  if (JSON.stringify(whens) !== JSON.stringify(['all:true', 'today:false', 'weekend:false', 'month:false'])) e.push('ボタン: ' + JSON.stringify(whens));
  if (!/<p class="ev-filter-status"[^>]* hidden>/.test(ev)) e.push('件数の表示が hidden でない');
  if (!/<p class="ev-empty ev-filter-empty" hidden>/.test(ev)) e.push('0件の表示が hidden でない');
  if (!/<script src="\/js\/events-filter\.min\.[0-9a-f]+\.js" integrity="sha256-[^"]+" defer><\/script>/.test(ev)) e.push('events-filter.js の読み込みが無い');
  const list = ev.indexOf('<div class="ev-list">'), past = ev.indexOf('<details class="ev-past">');
  if (list < 0 || past < list) e.push('.ev-list が無いか、終了したイベントより後にある');
});
check('日本時間の今日: UTC 14:59／15:01 の境目と年の境目', (e) => {
  const T2 = [['2026-10-04T14:59:59Z', '2026-10-04'], ['2026-10-04T15:00:01Z', '2026-10-05'], ['2026-10-05T10:30:00-04:00', '2026-10-05'], ['2026-12-31T15:00:00Z', '2027-01-01']];
  for (const [at, want] of T2) if (F.jstToday(new Date(at)) !== want) e.push(at + ': 期待 ' + want + ' 実際 ' + F.jstToday(new Date(at)));
  // 閲覧者の端末のタイムゾーンが違っても同じ結果になる（別プロセスで TZ を変えて確かめる）
  const prog = 'const vm=require("vm");const c={};vm.createContext(c);vm.runInContext(require("fs").readFileSync(process.argv[1],"utf8"),c);'
    + 'console.log(' + JSON.stringify(T2.map((t) => t[0])) + '.map(a=>c.EvFilter.jstToday(new Date(a))).join(","))';
  for (const tz of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    const rr = spawnSync(process.execPath, ['-e', prog, path.join(ROOT, 'assets/js/events-filter.js')], { encoding: 'utf8', env: { ...process.env, TZ: tz } });
    if ((rr.stdout || '').trim() !== T2.map((t) => t[1]).join(',')) e.push('TZ=' + tz + ': ' + (rr.stdout || rr.stderr).trim());
  }
});
check('判定する期間: 今日・今週末（平日／土曜／日曜／月またぎ）・今月（月末・うるう年）・すべて', (e) => {
  const R = [
    ['today', '2026-11-04', ['2026-11-04', '2026-11-04']], ['weekend', '2026-11-04', ['2026-11-07', '2026-11-08']],
    ['weekend', '2026-11-07', ['2026-11-07', '2026-11-08']], ['weekend', '2026-11-08', ['2026-11-08', '2026-11-08']],
    ['weekend', '2026-10-30', ['2026-10-31', '2026-11-01']], ['month', '2026-11-04', ['2026-11-04', '2026-11-30']],
    ['month', '2027-02-10', ['2027-02-10', '2027-02-28']], ['month', '2028-02-10', ['2028-02-10', '2028-02-29']],
    ['month', '2026-12-31', ['2026-12-31', '2026-12-31']], ['all', '2026-11-04', null],
  ];
  for (const [w, t, want] of R) { const got = F.range(w, t); if (JSON.stringify(got) !== JSON.stringify(want)) e.push(w + ' ' + t + ': 期待 ' + JSON.stringify(want) + ' 実際 ' + JSON.stringify(got)); }
  if (JSON.stringify(F.WHENS) !== JSON.stringify(['all', 'today', 'weekend', 'month'])) e.push('?when= に使える値: ' + JSON.stringify(F.WHENS));
});
check('行の判定: このページの行を 2099-03-04（水）・03-05 に絞り込むと期待どおり', (e) => {
  const shown = (when, today) => order.filter((s) => section[s] !== 'past'
    && F.matches(F.parseSpans(attrOf(s, 'data-spans')), /data-open="1"/.test(rowAttr[s]), F.range(when, today))).sort();
  const want = {
    'weekend 2099-03-04': ['dates-only', 'ongoing-after', 'period-ongoing', 'rest-four-plus', 'rest-with-current-period'],
    'month 2099-03-04': ['dates-only', 'ongoing-after', 'period-ongoing', 'rest-four-plus', 'rest-with-current-period'],
    'today 2099-03-05': ['ongoing-after', 'period-ongoing', 'rest-four-plus', 'rest-with-current-period'],
    'today 2099-03-04': ['ongoing-after', 'period-ongoing', 'rest-with-current-period'],
  };
  for (const [k, v] of Object.entries(want)) { const [w, t] = k.split(' '); const got = shown(w, t); if (JSON.stringify(got) !== JSON.stringify(v)) e.push(k + ': 期待 ' + v.join(', ') + ' 実際 ' + got.join(', ')); }
  if (shown('all', '2099-03-04').length !== order.filter((s) => section[s] !== 'past').length) e.push('「すべて」で全行にならない');
  if (F.parseSpans('2099-01-01/2099-01-02 x 2099-03-02/2099-03-01 2099-1-1/2099-1-2').length !== 1) e.push('不正な値を読んでいる');
});

// ---- 日本時間の日付の境目（判定する時刻を固定した別のサイト） ----
const DIR2 = fs.mkdtempSync(path.join(os.tmpdir(), 'events-jst-'));
const w2 = (rel, text) => { const p = path.join(DIR2, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
for (const f of PARTIALS) w2('layouts/partials/' + f, fs.readFileSync(path.join(ROOT, 'layouts/partials', f), 'utf8'));
w2('layouts/partials/cover-image.html', '{{- return "" -}}\n');
w2('layouts/_default/events.html', fs.readFileSync(path.join(ROOT, 'layouts/_default/events.html'), 'utf8'));
w2('layouts/_default/baseof.html', '<html><body>{{ block "main" . }}{{ end }}</body></html>\n');
w2('layouts/_default/single.html', '{{- define "main" }}{{ end }}\n');
w2('layouts/home.html', 'JST={{ partial "date-jst.html" (time.AsTime site.Params.eventsNow) }}\n');
w2('content/events.md', '---\ntitle: "イベントカレンダー"\nlayout: "events"\n---\n本文\n');
const B = {
  'b-1004': 'eventDate: "2026-10-04"', 'b-1005': 'eventDate: "2026-10-05"', 'b-1006': 'eventDate: "2026-10-06"', 'b-0101': 'eventDate: "2027-01-01"',
  'b-five': 'eventDates:\n  - "2026-09-01"\n  - "2026-09-15"\n  - "2026-10-10"\n  - "2026-10-20"\n  - "2026-11-03"',
};
for (const [slug, fm] of Object.entries(B)) w2('content/posts/' + slug + '.md', '---\ntitle: "' + slug + '"\ndate: 2020-01-01T10:00:00+09:00\nslug: "' + slug + '"\ncategories:\n  - "イベント"\n' + fm + '\nhideEventBox: true\n---\n本文\n');
// [判定する時刻, 説明, 日本時間の日付, b-1004, b-1005, b-1006, b-0101 の区分]
const U = 'upcoming', O = 'ongoing', P = 'past';
const T = [
  ['2026-10-04T14:59:59Z', 'JST 10/4 23:59:59（0時の直前）', '2026-10-04', O, U, U, U],
  ['2026-10-04T15:00:01Z', 'JST 10/5 00:00:01（0時の直後。UTC は 10/4）', '2026-10-05', P, O, U, U],
  ['2026-10-05T05:59:00Z', 'JST 10/5 14:59', '2026-10-05', P, O, U, U],
  ['2026-10-05T06:00:00Z', 'JST 10/5 15:00（旧実装のローカルビルドで翌日になっていた時刻）', '2026-10-05', P, O, U, U],
  ['2026-10-05T14:59:00Z', 'JST 10/5 23:59', '2026-10-05', P, O, U, U],
  ['2026-10-05T20:00:00Z', 'JST 10/6 05:00（UTC は 10/5 20:00）', '2026-10-06', P, P, O, U],
  ['2026-10-05T23:59:00+09:00', 'JST 10/5 23:59（+09:00 表記）', '2026-10-05', P, O, U, U],
  ['2026-10-05T10:30:00-04:00', 'JST 10/5 23:30（-04:00 表記）', '2026-10-05', P, O, U, U],
  ['2026-12-31T15:00:00Z', 'JST 2027/1/1 00:00（年の境目。UTC は 12/31）', '2027-01-01', P, P, P, O],
];
const TZS = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Kiritimati'];
for (const [at, label, jst, s1004, s1005, s1006, s0101] of T) {
  check('日本時間の境目: ' + label, (e) => {
    for (const tz of TZS) {
      w2('hugo.toml', 'baseURL = "https://example.test/"\ndefaultContentLanguage = "ja"\ndisableKinds = ["taxonomy", "term", "RSS", "sitemap", "robotsTXT", "404", "section"]\n[params]\neventsNow = "' + at + '"\n');
      const out = path.join(DIR2, 'public');
      fs.rmSync(out, { recursive: true, force: true });
      const rr = spawnSync(HUGO, ['--source', DIR2, '--destination', out, '--quiet'], { encoding: 'utf8', env: { ...process.env, TZ: tz } });
      if (rr.status !== 0) { e.push('TZ=' + tz + ' でビルド失敗: ' + (rr.stderr || rr.stdout)); continue; }
      const got = (/JST=(\S+)/.exec(fs.readFileSync(path.join(out, 'index.html'), 'utf8')) || [])[1];
      if (got !== jst) e.push('TZ=' + tz + ' 日本時間の日付: 期待 ' + jst + ' 実際 ' + got);
      const html = fs.readFileSync(path.join(out, 'events/index.html'), 'utf8');
      const sec = {}; let cur2 = '';
      for (const m of html.matchAll(/<h2 class="ev-month">([^<]*)<\/h2>|<a class="ev-row( is-past)?" href="\/posts\/([^/]+)\/"[^>]*>/g)) {
        if (m[1] !== undefined) { cur2 = m[1] === '開催中' ? O : U; continue; }
        sec[m[3]] = m[2] ? P : cur2;
      }
      const want = { 'b-1004': s1004, 'b-1005': s1005, 'b-1006': s1006, 'b-0101': s0101 };
      for (const [slug, st] of Object.entries(want)) if (sec[slug] !== st) e.push('TZ=' + tz + ' ' + slug + ': 期待 ' + st + ' 実際 ' + sec[slug]);
      if (at === '2026-10-05T06:00:00Z') {
        // 5日程（9/1・9/15・10/10・10/20・11/3）を 10/5 に見ると、今後の日程は 10/10・10/20・11/3
        const row = (/<a class="ev-row" href="\/posts\/b-five\/"[^>]*>([\s\S]*?)<\/a>/.exec(html) || [])[1] || '';
        const sched = (/今後の日程：([\s\S]*?)<\/span>/.exec(row) || [])[1] || '';
        const dts = [...sched.matchAll(/datetime="([^"]+)"/g)].map((x) => x[1]);
        if (JSON.stringify(dts) !== JSON.stringify(['2026-10-10', '2026-10-20', '2026-11-03'])) e.push('TZ=' + tz + ' b-five の今後の日程: ' + JSON.stringify(dts));
      }
    }
  });
}
fs.rmSync(DIR2, { recursive: true, force: true });

fs.rmSync(DIR, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
