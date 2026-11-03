#!/usr/bin/env node
/*
 * トップの「近日のイベント」「最近の開店・閉店」と home_section_click のテスト（工程4B-1）。リポジトリ直下で実行:
 *   node scripts/validate/test/home-hugo.mjs            （hugo が PATH にある場合）
 *   HUGO=/path/to/hugo node scripts/validate/test/home-hugo.mjs
 * 一時ディレクトリに最小の Hugo サイトを作り、リポジトリの partials/home-events.html・home-openclose.html と
 * 判定の部品（event-calendar-eligible・event-dates・event-calendar-status・shop-status ほか）をそのまま使ってビルドする。
 * 判定時刻は site.Params.eventsNow で固定し、件数・並び（会期の短いもの→長期開催）・0件で出さないこと・状態のラベルを確かめる。
 * 後半は partials/affiliate-tracking.html の <script> を Node で実行し、home_section_click が
 * トップのブロック内の内部リンクだけで送られ、affiliate_click と二重にならないことを確かめる。依存ライブラリなし。失敗があれば終了コード 1。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const ROOT = process.cwd();
const HUGO = process.env.HUGO || 'hugo';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
const w = (rel, text) => { const p = path.join(DIR, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const copy = (rel) => w(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'));

for (const f of ['date-ymd.html', 'date-jst.html', 'event-dates.html', 'event-dates-text.html', 'event-calendar-eligible.html', 'event-calendar-status.html',
  'shop-status.html', 'ev-row.html', 'home-events.html', 'home-openclose.html']) copy('layouts/partials/' + f);
w('layouts/partials/cover-image.html', '{{- return "" -}}\n');
w('layouts/_default/baseof.html', '<html><body>{{ block "main" . }}{{ end }}</body></html>\n');
w('layouts/_default/single.html', '{{- define "main" }}{{ end }}\n');
w('layouts/home.html', '<div id="events">{{ partial "home-events.html" . }}</div><div id="openclose">{{ partial "home-openclose.html" . }}</div>\n');
w('data/openclose.yaml', '{}\n');
const config = (now) => w('hugo.toml', 'baseURL = "https://example.test/"\ndefaultContentLanguage = "ja"\ndisableKinds = ["taxonomy", "term", "RSS", "sitemap", "robotsTXT", "404", "section"]\n[params]\neventsNow = "' + now + '"\n');
const post = (slug, fm, { cat = 'イベント', date = '2020-01-01T10:00:00+09:00', title = slug } = {}) =>
  w('content/posts/' + slug + '.md', '---\ntitle: "' + title + '"\ndate: ' + date + '\nslug: "' + slug + '"\ncategories:\n  - "' + cat + '"\n' + fm + '\nhideEventBox: true\n---\n本文\n');

// ---- イベント（判定日は 2099-03-04 水曜） ----
post('ongoing-short', 'eventDate: "2099-03-03/2099-03-05"');
post('ongoing-today', 'eventDate: "2099-03-04"');
post('ongoing-long', 'eventDate: "2099-02-01/2099-03-31"');
post('open-end', 'eventDate: "2099-01-01"\neventOngoing: true');
post('upcoming-1', 'eventDate: "2099-03-07"');
post('upcoming-2', 'eventDates:\n  - "2099-03-10"\n  - "2099-03-12"');
post('upcoming-3', 'eventDate: "2099-03-20"');
post('upcoming-long', 'eventDate: "2099-03-06/2099-04-30"');
post('ended', 'eventDate: "2020-02-01"');
post('fair', 'eventKind: "fair"\neventDate: "2099-03-05"', { cat: 'グルメ・カフェ' });
post('match', 'eventKind: "match"\neventDate: "2099-03-08"', { cat: 'スポーツ' });

// ---- 開店・閉店（掲載日の新しい順に3件。ほかのカテゴリは入れない） ----
post('oc-newest', 'shopStatus: "open"\nshopDate: "2020-03-01"', { cat: '開店・閉店', date: '2020-03-04T10:00:00+09:00', title: '店A オープン' });
post('oc-second', 'shopStatus: "close_planned"\nshopUnconfirmed: true\nshopDate: "2020-04"', { cat: '開店・閉店', date: '2020-03-03T10:00:00+09:00', title: '店B 閉店へ' });
post('oc-third', 'shopStatus: "renewal"\nshopDate: "2020-03-10"', { cat: '開店・閉店', date: '2020-03-02T10:00:00+09:00', title: '店C リニューアル' });
post('oc-fourth', 'shopStatus: "open"\nshopDate: "2020-02-01"', { cat: '開店・閉店', date: '2020-03-01T10:00:00+09:00', title: '店D オープン' });
post('gourmet-newer', '', { cat: 'グルメ・カフェ', date: '2020-03-05T10:00:00+09:00', title: 'グルメの記事' });

let pass = 0, fail = 0;
const check = (name, fn) => { const e = []; fn(e); if (e.length) { fail++; console.log('  FAIL ' + name + '\n       ' + e.join('\n       ')); } else { pass++; console.log('  ok   ' + name); } };
const build = (now) => {
  config(now);
  fs.rmSync(path.join(DIR, 'public'), { recursive: true, force: true });
  const r = spawnSync(HUGO, ['--source', DIR, '--destination', path.join(DIR, 'public'), '--quiet'], { encoding: 'utf8' });
  if (r.status !== 0) { console.log('  FAIL Hugo のビルドが失敗しました（' + now + '）\n' + (r.stderr || r.stdout || r.error)); process.exit(1); }
  return fs.readFileSync(path.join(DIR, 'public/index.html'), 'utf8');
};
const part = (html, id) => (new RegExp('<div id="' + id + '">([\\s\\S]*?)</div>\\s*(?:<div id=|$)').exec(html) || [])[1] ?? '';
const evSlugs = (html) => [...part(html, 'events').matchAll(/<a class="ev-row" href="\/posts\/([^/]+)\/"/g)].map((m) => m[1]);
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

let html = build('2099-03-04T12:00:00+09:00');
check('近日のイベント: 会期の短いものを開催中（終了日の近い順）→開催予定（開始日順）で4件', (e) => {
  const want = ['ongoing-today', 'ongoing-short', 'upcoming-1', 'match']; // 試合（eventKind: match）も /events/ と同じく載る
  const got = evSlugs(html);
  if (JSON.stringify(got) !== JSON.stringify(want)) e.push('期待 ' + want.join(', ') + ' 実際 ' + got.join(', '));
});
check('近日のイベント: 見出し・カレンダーへのリンク・計測用の属性', (e) => {
  const ev = part(html, 'events');
  if (!/<section class="home-block" data-home-section="events"/.test(ev)) e.push('data-home-section="events" のブロックが無い');
  if (!/<h2 id="home-events-title">近日のイベント<\/h2>/.test(ev)) e.push('見出しが無い');
  if (!/href="\/events\/"/.test(ev)) e.push('/events/ へのリンクが無い');
  if (/今日/.test(strip(ev))) e.push('「今日」と書いている（ビルド時点の情報なので書かない）');
});
check('近日のイベント: 開催中だけに「開催中」を付ける', (e) => {
  const rows = [...part(html, 'events').matchAll(/<a class="ev-row" href="\/posts\/([^/]+)\/"[^>]*>([\s\S]*?)<\/a>/g)];
  for (const [, slug, body] of rows) {
    const now = /ev-now/.test(body);
    if (now !== slug.startsWith('ongoing')) e.push(slug + ': 開催中の表示 ' + now);
  }
});
check('近日のイベント: 終了・非掲載（fair）は出さず、試合には「試合」を付ける（/events/ と同じ）', (e) => {
  if (!/ev-kind">試合/.test(part(html, 'events'))) e.push('試合の表示が無い');
  const got = evSlugs(html);
  for (const s of ['ended', 'fair']) if (got.includes(s)) e.push(s + ' が出ている');
});

html = build('2099-03-21T12:00:00+09:00');
check('近日のイベント: 短い会期が無いときは長期開催・終了日未定で埋める（開催中の終了日順、終了日未定は最後）', (e) => {
  const want = ['ongoing-long', 'upcoming-long', 'open-end'];
  const got = evSlugs(html);
  if (JSON.stringify(got) !== JSON.stringify(want)) e.push('期待 ' + want.join(', ') + ' 実際 ' + got.join(', '));
});

fs.rmSync(path.join(DIR, 'content/posts/open-end.md'));
html = build('2100-06-01T12:00:00+09:00');
check('近日のイベント: 0件ならブロックごと出さない', (e) => {
  const ev = part(html, 'events');
  if (ev.trim() !== '') e.push('出力がある: ' + strip(ev).slice(0, 80));
});
check('最近の開店・閉店: カテゴリ「開店・閉店」の新しい3件・年表と同じラベル・年表へのリンク', (e) => {
  const oc = part(html, 'openclose');
  if (!/<section class="home-block" data-home-section="openclose"/.test(oc)) e.push('data-home-section="openclose" のブロックが無い');
  if (!/href="\/open-close\/"/.test(oc)) e.push('/open-close/ へのリンクが無い');
  const rows = [...oc.matchAll(/<a class="oc-row" href="\/posts\/([^/]+)\/">([\s\S]*?)<\/a>/g)].map((m) => [m[1], strip(m[2])]);
  const want = [['oc-newest', 'オープン 店A オープン 2020/3/4掲載'], ['oc-second', '閉店予定（未確認） 店B 閉店へ 2020/3/3掲載'], ['oc-third', 'リニューアル 店C リニューアル 2020/3/2掲載']];
  if (JSON.stringify(rows) !== JSON.stringify(want)) e.push('期待 ' + JSON.stringify(want) + '\n       実際 ' + JSON.stringify(rows));
  if (!/oc-badge oc-close-planned oc-unconfirmed/.test(oc)) e.push('未確認のバッジのクラスが年表と違う');
});
for (const f of fs.readdirSync(path.join(DIR, 'content/posts'))) if (f.startsWith('oc-')) fs.rmSync(path.join(DIR, 'content/posts', f));
html = build('2100-06-01T12:00:00+09:00');
check('最近の開店・閉店: 0件ならブロックごと出さない', (e) => {
  const oc = part(html, 'openclose');
  if (oc.trim() !== '') e.push('出力がある: ' + strip(oc).slice(0, 80));
});

// ---- home_section_click（partials/affiliate-tracking.html の <script> を実行） ----
const tpl = fs.readFileSync(path.join(ROOT, 'layouts/partials/affiliate-tracking.html'), 'utf8');
const js = (/<script>([\s\S]*?)<\/script>/.exec(tpl) || [])[1] || '';
let handler = null; const sent = [];
vm.runInNewContext(js, {
  document: { addEventListener: (type, fn) => { if (type === 'click') handler = fn; }, documentElement: { lang: 'ja' } },
  location: { hostname: 'urayasu-portal.com', pathname: '/' },
  gtag: (cmd, name, params) => sent.push([name, params]),
  URL,
});
const click = ({ href, host, section = null, cls = [], attrs = {} }) => {
  const a = {
    href, hostname: host,
    classList: { contains: (c) => cls.includes(c) },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    closest: (sel) => (sel === 'a[href]' ? a : sel === '[data-home-section]' && section ? { getAttribute: () => section } : null),
  };
  sent.length = 0;
  handler({ target: a });
  return JSON.stringify(sent);
};
check('home_section_click: トップのブロック内の内部リンクで section だけを送る', (e) => {
  if (!handler) { e.push('click のハンドラーが登録されない'); return; }
  const got = click({ href: 'https://urayasu-portal.com/events/', host: 'urayasu-portal.com', section: 'events' });
  const want = JSON.stringify([['home_section_click', { section: 'events' }]]);
  if (got !== want) e.push('期待 ' + want + ' 実際 ' + got);
});
check('home_section_click: ブロックの外の内部リンクでは送らない', (e) => {
  const got = click({ href: 'https://urayasu-portal.com/posts/x/', host: 'urayasu-portal.com' });
  if (got !== '[]') e.push('送られた: ' + got);
});
check('home_section_click: ブロック内でも外部の予約リンクは affiliate_click だけ（二重に送らない）', (e) => {
  const got = click({ href: 'https://tp.media/r?x', host: 'tp.media', section: 'travel', attrs: { rel: 'sponsored' } });
  const names = JSON.parse(got).map((x) => x[0]);
  if (JSON.stringify(names) !== JSON.stringify(['affiliate_click'])) e.push('送られたイベント: ' + names.join(', '));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
fs.rmSync(DIR, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
