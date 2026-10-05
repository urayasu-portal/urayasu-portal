#!/usr/bin/env node
/*
 * イベントカレンダー（/events/）と Event 構造化データのテスト（工程1a PR 4）。リポジトリ直下で実行:
 *   node scripts/validate/test/events-hugo.mjs            （hugo が PATH にある場合）
 *   HUGO=/path/to/hugo node scripts/validate/test/events-hugo.mjs
 * 一時ディレクトリに最小の Hugo サイトを作り、リポジトリの layouts/_default/events.html と関連 partial をそのまま使って
 * 約20通りの記事をビルドし、/events/ の掲載・区分・並び・表示と、各記事の Event JSON-LD を期待値と比べる。
 * 今日の日付に依存しないよう、過去は 2020 年、未来は 2099 年の日付を使う。依存ライブラリなし。失敗があれば終了コード 1。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const HUGO = process.env.HUGO || 'hugo';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'events-'));
const w = (rel, text) => { const p = path.join(DIR, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };

w('hugo.toml', 'baseURL = "https://example.test/"\ndefaultContentLanguage = "ja"\ndisableKinds = ["taxonomy", "term", "RSS", "sitemap", "robotsTXT", "404", "home", "section"]\n');
for (const f of ['date-ymd.html', 'event-dates.html', 'event-dates-text.html', 'event-calendar-eligible.html', 'event-calendar-status.html', 'event-jsonld-eligible.html', 'event-jsonld.html']) {
  w('layouts/partials/' + f, fs.readFileSync(path.join(ROOT, 'layouts/partials', f), 'utf8'));
}
w('layouts/partials/cover-image.html', '{{- return "" -}}\n'); // 画像は扱わない
w('layouts/_default/events.html', fs.readFileSync(path.join(ROOT, 'layouts/_default/events.html'), 'utf8'));
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
c('dates-only', 'eventDates:\n  - "2099-03-01"\n  - "2099-03-08"\n' + LOC, { cal: 'upcoming', date: '3/1', summary: true, ld: [['2099-03-01', null], ['2099-03-08', null]], ids: true });
c('multi-session', 'eventDates:\n  - "2099-04-01/2099-04-03"\n  - "2099-05-01/2099-05-03"\n' + LOC, { cal: 'upcoming', date: '4/1', ld: [['2099-04-01', '2099-04-03'], ['2099-05-01', '2099-05-03']] });
c('partly-past', 'eventDates:\n  - "2020-01-01"\n  - "2099-07-01"', { cal: 'upcoming', date: '7/1', summary: true, ld: [] });
c('all-past', 'eventDate: "2020-02-01"', { cal: 'past', ld: [] });
c('ongoing-before', 'eventDate: "2099-08-01"\neventOngoing: true\n' + LOC, { cal: 'upcoming', date: '8/1', ld: [['2099-08-01', null]] });
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
const section = {}, rowText = {}, order = [];
let cur = '';
for (const m of ev.matchAll(/<h2 class="ev-month">([^<]*)<\/h2>|<a class="ev-row( is-past)?" href="\/posts\/([^/]+)\/">([\s\S]*?)<\/a>/g)) {
  if (m[1] !== undefined) { cur = m[1] === '開催中' ? 'ongoing' : 'upcoming'; continue; }
  const slug = m[3];
  section[slug] = m[2] ? 'past' : cur; rowText[slug] = strip(m[4]); order.push(slug);
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
    if (k.expect.summary && !/日程：/.test(t)) e.push('日程の要約が無い');
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
  const want = ['period-ongoing-earlier-end', 'period-ongoing', 'ongoing-after'];
  if (JSON.stringify(on) !== JSON.stringify(want)) e.push('期待 ' + want.join(', ') + ' 実際 ' + on.join(', '));
});
check('開催予定の並び: 次回の開催日順', (e) => {
  const up = order.filter((s) => section[s] === 'upcoming');
  const first = ['dates-only', 'multi-session', 'single-future', 'partly-past', 'ongoing-before'];
  if (JSON.stringify(up.slice(0, 5)) !== JSON.stringify(first)) e.push('期待 ' + first.join(', ') + ' … 実際 ' + up.slice(0, 5).join(', '));
});
fs.rmSync(DIR, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
