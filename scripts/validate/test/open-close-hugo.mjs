#!/usr/bin/env node
/*
 * 開店・閉店年表（/open-close/）と店舗の状態（shopStatus・shopDate・shopUnconfirmed）のテスト（工程1a PR 5）。リポジトリ直下で実行:
 *   node scripts/validate/test/open-close-hugo.mjs            （hugo が PATH にある場合）
 *   HUGO=/path/to/hugo node scripts/validate/test/open-close-hugo.mjs
 * 一時ディレクトリに最小の Hugo サイトを作り、リポジトリの年表・/daily/・/events/ のテンプレートと関連 partial をそのまま使って
 * 判定時刻を固定（site.Params.eventsNow）してビルドし、年表の区分・並び・件数・予定日経過、/daily/ の日付バッジ、
 * サイドバーの点灯、/events/ と Event JSON-LD に入らないこと、記事の通知を確かめる。
 * /daily/ は生成された <script> を Node で実行して表示を確かめる。依存ライブラリなし。失敗があれば終了コード 1。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const HUGO = process.env.HUGO || 'hugo';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'open-close-'));
const w = (rel, text) => { const p = path.join(DIR, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const copy = (rel) => w(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'));

for (const f of ['date-ymd.html', 'date-jst.html', 'event-dates.html', 'event-dates-text.html', 'shop-status.html', 'event-calendar-eligible.html', 'event-calendar-status.html',
  'event-jsonld-eligible.html', 'event-jsonld.html', 'sidebar-calendar-data.html', 'event-ended-notice.html']) copy('layouts/partials/' + f);
for (const f of ['cover-image.html', 'article-thumb.html', 'card-dates.html', 'sidebar-calendar.html', 'sidebar-cat-counts.html']) w('layouts/partials/' + f, f === 'cover-image.html' ? '{{- return "" -}}\n' : '');
copy('layouts/_default/openclose.html'); copy('layouts/_default/events.html'); copy('layouts/daily/list.html');
for (const f of fs.readdirSync(path.join(ROOT, 'i18n'))) copy('i18n/' + f);
w('layouts/_default/baseof.html', '<html><body>{{ block "main" . }}{{ end }}</body></html>\n');
w('layouts/_default/single.html', '{{- define "main" }}<div id="notice">{{ partial "event-ended-notice.html" . }}</div><div id="jsonld">{{ partial "event-jsonld.html" . }}</div>{{ end }}\n');
w('layouts/home.html', '{{- $cal := partialCached "sidebar-calendar-data.html" site site.Language.Lang }}<pre id="sidebar">{{ $cal.eventDates | jsonify }}</pre>\n');
w('content/open-close.md', '---\ntitle: "年表"\nlayout: openclose\n---\n本文\n');
w('content/events.md', '---\ntitle: "イベントカレンダー"\nlayout: "events"\n---\n本文\n');
w('content/daily/_index.md', '---\ntitle: "日付で探す"\n---\n');
const config = (now) => w('hugo.toml', 'baseURL = "https://example.test/"\ndefaultContentLanguage = "ja"\ndisableKinds = ["taxonomy", "term", "RSS", "sitemap", "robotsTXT", "404"]\n[params]\neventsNow = "' + now + '"\n');

// ---- 記事（判定日は日本時間 2026-10-06） ----
const P = [];
const post = (slug, title, fm, { cat = '開店・閉店', date = '2026-09-01T10:00:00+09:00' } = {}) => P.push({ slug, title, fm, cat, date });
post('fm-open', '店A', 'shopStatus: "open"\nshopDate: "2026-09-21"');
post('fm-open-planned', '店B', 'shopStatus: "open_planned"\nshopDate: "2026-10-19"');
post('fm-open-planned-unconf', '店C', 'shopStatus: "open_planned"\nshopUnconfirmed: true\nshopDate: "2026-11"');
post('fm-close', '店D', 'shopStatus: "close"\nshopDate: "2026-09-27"');
post('fm-close-planned', '店E', 'shopStatus: "close_planned"\nshopDate: "2026-10-31"');
post('fm-temp-close', '店F', 'shopStatus: "temp_close"\nshopDate: "2026-09-28"');
post('fm-reopen', '店G', 'shopStatus: "reopen"\nshopDate: "2026-09-18"');
post('fm-renewal', '店H', 'shopStatus: "renewal"\nshopDate: "2026-09-17"');
post('fm-renewal-future', '店I', 'shopStatus: "renewal"\nshopDate: "2026-10-20"');
post('fm-move', '店J', 'shopStatus: "move"\nshopDate: "2026-10-01"');
post('fm-popup', '店K', 'shopStatus: "popup"\nshopDate: "2026-10-01"\neventDates:\n  - "2026-10-01/2026-10-15"\neventLocation: "イクスピアリ"');
post('fm-feature', 'まとめ記事', 'shopStatus: "feature"');
post('fm-nodate-open', '店L', 'shopStatus: "open"');
post('fm-planned-passed-day', '店M', 'shopStatus: "open_planned"\nshopDate: "2026-10-05"');
post('fm-planned-month-current', '店N', 'shopStatus: "open_planned"\nshopDate: "2026-10"');
post('fm-planned-month-past', '店O', 'shopStatus: "close_planned"\nshopDate: "2026-09"');
post('fm-open-unconf', '店P', 'shopStatus: "open"\nshopUnconfirmed: true\nshopDate: "2026-09-10"');
post('fm-invalid-date', '店Q', 'shopStatus: "open"\nshopDate: "2026-02-30"');
post('fm-other-cat', '店R', 'shopStatus: "open"\nshopDate: "2026-09-02"', { cat: 'グルメ・カフェ' });
post('yaml-type', '店S（タイトル）', '');
post('yaml-status', '店T', '');
post('yaml-dup-a', '店U', '');
post('yaml-dup-b', '店U 続報', '');
post('yaml-override-fm', '店V', 'shopStatus: "close"\nshopDate: "2026-08-20"');
post('yaml-unconf', '店W', '');
post('yaml-status-nodate', '店X', '');
post('legacy-temp', '【浦安】喫茶Xが一時休業　年内リニューアル予定', '');
post('legacy-reopen', '【浦安】カフェYが9月18日営業再開', '');
post('legacy-move', '「中華Z」浦安駅高架下再開発で3月上旬に移転予定', '');
post('legacy-renewal', '【浦安】ゴンチャがリニューアルオープン', 'eventDate: "2026-06-30"', { date: '2026-07-01T10:00:00+09:00' });
post('legacy-close-planned', '【浦安】老舗が9月末閉店へ', '');
post('legacy-close', '【行徳】医院が7月31日閉院との情報', 'eventDate: "2026-07-31"', { date: '2026-08-11T10:00:00+09:00' });
post('legacy-popup', '【浦安】イクスピアリに期間限定5店', 'eventDates:\n  - "2026-09-01/2026-09-17"');
post('legacy-popup2', '【浦安】アトレ新浦安に和菓子店、10月1日から限定出店', 'eventDate: "2026-10-01/2026-10-07"', { date: '2026-09-29T10:00:00+09:00' });
post('legacy-planned-ka', '【妙典】雑貨店が出店予定か　求人で判明', '');
post('legacy-open-future', '【浦安】イクスピアリに麻辣湯、10月19日オープン', 'eventDate: "2026-10-19"', { date: '2026-09-29T10:00:00+09:00' });
post('legacy-open-past', '【行徳】そば店がオープン', 'eventDate: "2026-09-04"', { date: '2026-09-14T10:00:00+09:00' });
post('legacy-planned-past', '【行徳】寿司店が9月30日オープン予定', 'eventDate: "2026-09-30"', { date: '2026-09-24T10:00:00+09:00' });
post('legacy-nodate', '【浦安】ヨガ教室が始動', '');
post('event-article', '【浦安】祭り', 'eventDate: "2026-10-20"\neventLocation: "公園"', { cat: 'イベント' });
post('notice-only', '【浦安市】制度の開始', 'notableDate: "2026-10-15"', { cat: 'お知らせ' });
for (const p of P) w('content/posts/' + p.slug + '.md', '---\ntitle: "' + p.title.replace(/"/g, '\\"') + '"\ndate: ' + p.date + '\nslug: "' + p.slug + '"\ncategories:\n  - "' + p.cat + '"\n' + (p.fm ? p.fm + '\n' : '') + 'hideEventBox: true\n---\n本文\n');
w('data/openclose.yaml', [
  '"yaml-type":\n  shop: "店S（キュレーション名）"\n  type: open\n  when: "2026-07"\n  area: "浦安"',
  '"yaml-status":\n  shop: "店T"\n  type: open\n  when: "2026-09"\n  status: open_planned\n  date: "2026-10-25"',
  '"yaml-dup-a":\n  shop: "店U"\n  status: open\n  date: "2026-06-02"',
  '"yaml-dup-b":\n  shop: "店U"\n  status: open\n  date: "2026-06-02"\n  count: false',
  '"yaml-override-fm":\n  shop: "店V（yaml）"\n  type: open\n  when: "2026-07"',
  '"yaml-unconf":\n  shop: "店W"\n  status: open_planned\n  unconfirmed: true\n  date: "2026-11"',
  '"yaml-status-nodate":\n  shop: "店X"\n  type: open\n  when: "2026-04"\n  status: open_planned',
].join('\n') + '\n');

let pass = 0, fail = 0;
const check = (name, fn) => { const e = []; try { fn(e); } catch (x) { e.push(String(x && x.stack || x)); } if (e.length) { fail++; console.log('  FAIL ' + name + '\n       ' + e.join('\n       ')); } else { pass++; console.log('  ok   ' + name); } };
const build = (now) => {
  config(now);
  const out = path.join(DIR, 'public');
  fs.rmSync(out, { recursive: true, force: true });
  const r = spawnSync(HUGO, ['--source', DIR, '--destination', out, '--quiet'], { encoding: 'utf8' });
  if (r.status !== 0) { console.log('  FAIL Hugo のビルドが失敗しました（' + now + '）\n' + (r.stderr || r.stdout || r.error)); process.exit(1); }
  return (rel) => fs.readFileSync(path.join(out, rel), 'utf8');
};
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const parseOC = (html) => {
  const rows = {}; const order = []; let month = '', sub = '';
  for (const m of html.matchAll(/<h2 class="oc-month">([^<]*)<\/h2>|<h3 class="oc-sub">([^<]*)<\/h3>|<a class="oc-row" href="\/posts\/([^/]+)\/">([\s\S]*?)<\/a>/g)) {
    if (m[1] !== undefined) { month = m[1]; sub = ''; continue; }
    if (m[2] !== undefined) { sub = m[2]; continue; }
    const b = m[4];
    rows[m[3]] = { section: month + (sub ? '/' + sub : ''), label: (/<span class="oc-badge[^"]*">([^<]*)<\/span>/.exec(b) || [])[1],
      shop: strip((/<span class="oc-shop">([\s\S]*?)<\/span>/.exec(b) || ['', ''])[1]), date: strip((/<span class="oc-date">([\s\S]*?)<\/span>/.exec(b) || ['', ''])[1]), passed: /oc-passed/.test(b) };
    order.push(m[3]);
  }
  const stats = Object.fromEntries([...html.matchAll(/<strong>(\d+)<\/strong> 件の([^<（]*)/g)].map((m) => [m[2], +m[1]]));
  return { rows, order, stats };
};
const runDaily = (html, query) => {
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('ALL_POSTS'));
  const els = {};
  const document = { getElementById: (id) => (els[id] = els[id] || { textContent: '', innerHTML: '', style: {} }) };
  const win = { location: { search: query } };
  new Function('document', 'window', script.replace('const ALL_POSTS =', 'const ALL_POSTS = window.__posts ='))(document, win);
  const cards = {};
  for (const m of (els['daily-results'] || { innerHTML: '' }).innerHTML.matchAll(/<a class="article-card[^"]*" href="\/posts\/([^/]+)\/">([\s\S]*?)<\/a>/g)) {
    cards[m[1]] = strip((/<i class="ti ti-calendar-star"[^>]*><\/i>([^<]*)<\/span>/.exec(m[2]) || ['', ''])[1]);
  }
  const posts = win.__posts;
  return { cards, posts };
};

// ---- 判定日 2026-10-06（JST 12:00） ----
const get = build('2026-10-06T03:00:00Z');
const oc = parseOC(get('open-close/index.html'));
console.log('  ok   ' + P.length + ' 本の記事でビルドが成功'); pass++;
const EXP = {
  'fm-open': ['2026年9月', 'オープン', '9月21日', false],
  'fm-open-planned': ['2026年10月', 'オープン予定', '10月19日', false],
  'fm-open-planned-unconf': ['2026年11月/日付未定', '出店予定（未確認）', '', false],
  'fm-close': ['2026年9月', '閉店', '9月27日', false],
  'fm-close-planned': ['2026年10月', '閉店予定', '10月31日', false],
  'fm-temp-close': ['2026年9月', '休業', '9月28日', false],
  'fm-reopen': ['2026年9月', '営業再開', '9月18日', false],
  'fm-renewal': ['2026年9月', 'リニューアル', '9月17日', false],
  'fm-renewal-future': ['2026年10月', 'リニューアル', '10月20日', false],
  'fm-move': ['2026年10月', '移転', '10月1日', false],
  'fm-popup': ['2026年10月', '期間限定出店', '10月1日', false],
  'fm-feature': ['時期未定', 'まとめ', '', false],
  'fm-nodate-open': ['時期未定', 'オープン', '', false],
  'fm-planned-passed-day': ['2026年10月', 'オープン予定', '10月5日', true],
  'fm-planned-month-current': ['2026年10月/日付未定', 'オープン予定', '', false],
  'fm-planned-month-past': ['2026年9月/日付未定', '閉店予定', '', true],
  'fm-open-unconf': ['2026年9月', 'オープン（未確認）', '9月10日', false],
  'fm-invalid-date': ['時期未定', 'オープン', '', false],
  'fm-other-cat': ['2026年9月', 'オープン', '9月2日', false],
  'yaml-type': ['2026年7月/日付未定', 'オープン', '', false],
  'yaml-status': ['2026年10月', 'オープン予定', '10月25日', false],
  'yaml-dup-a': ['2026年6月', 'オープン', '6月2日', false],
  'yaml-dup-b': ['2026年6月', 'オープン', '6月2日', false],
  'yaml-override-fm': ['2026年8月', '閉店', '8月20日', false],
  'yaml-unconf': ['2026年11月/日付未定', '出店予定（未確認）', '', false],
  'yaml-status-nodate': ['時期未定', 'オープン予定', '', false], /* status を書いた行は旧 when（報道月）を使わない */
  'legacy-temp': ['時期未定', '休業', '', false],
  'legacy-reopen': ['時期未定', '営業再開', '', false],
  'legacy-move': ['時期未定', '移転', '', false],
  'legacy-renewal': ['2026年6月', 'リニューアル', '6月30日', false],
  'legacy-close-planned': ['時期未定', '閉店予定', '', false],
  'legacy-close': ['2026年7月', '閉店', '7月31日', false],
  'legacy-popup': ['2026年9月', '期間限定出店', '9月1日', false],
  'legacy-popup2': ['2026年10月', '期間限定出店', '10月1日', false],
  'legacy-planned-ka': ['時期未定', 'オープン予定', '', false],
  'legacy-open-future': ['2026年10月', 'オープン予定', '10月19日', false],
  'legacy-open-past': ['2026年9月', 'オープン', '9月4日', false],
  'legacy-planned-past': ['2026年9月', 'オープン予定', '9月30日', true],
  'legacy-nodate': ['時期未定', 'オープン', '', false],
};
for (const [slug, [section, label, date, passed]] of Object.entries(EXP)) {
  check('年表: ' + slug, (e) => {
    const r = oc.rows[slug];
    if (!r) { e.push('年表に無い'); return; }
    if (r.section !== section) e.push('区分: 期待 ' + section + ' 実際 ' + r.section);
    if (r.label !== label) e.push('ラベル: 期待 ' + label + ' 実際 ' + r.label);
    if (r.date !== date) e.push('日付: 期待「' + date + '」 実際「' + r.date + '」');
    if (r.passed !== passed) e.push('予定日経過: 期待 ' + passed + ' 実際 ' + r.passed);
  });
}
check('年表に載らない記事（イベント・お知らせ）', (e) => { for (const s of ['event-article', 'notice-only']) if (oc.rows[s]) e.push(s + ' が年表にある'); });
check('yaml の shop が表示名になる・frontmatter があれば yaml の状態より優先', (e) => {
  if (oc.rows['yaml-type'].shop !== '店S（キュレーション名）') e.push('yaml-type の表示名 ' + oc.rows['yaml-type'].shop);
  if (oc.rows['yaml-override-fm'].label !== '閉店') e.push('frontmatter が優先されていない');
});
check('件数: 確認済みの開店・閉店、日付を過ぎたリニューアル。未確認・予定・期間限定・日付不明・count: false は数えない', (e) => {
  const want = { '開店': 5, '閉店': 3, 'リニューアル': 2 };
  for (const [k, n] of Object.entries(want)) if (oc.stats[k] !== n) e.push(k + ': 期待 ' + n + ' 実際 ' + oc.stats[k]);
});
check('月の中の並び: 日付の新しい順 → 「日付未定」（年月だけ）', (e) => {
  const oct = oc.order.filter((s) => oc.rows[s].section.startsWith('2026年10月'));
  const want = ['fm-close-planned', 'yaml-status', 'fm-renewal-future', 'legacy-open-future', 'fm-open-planned', 'fm-planned-passed-day', 'fm-popup', 'fm-move', 'legacy-popup2', 'fm-planned-month-current'];
  const norm = (a) => a.map((s) => (s === 'legacy-open-future' || s === 'fm-open-planned' ? '10/19' : ['fm-popup', 'fm-move', 'legacy-popup2'].includes(s) ? '10/1' : s));
  if (JSON.stringify(norm(oct)) !== JSON.stringify(norm(want))) e.push('期待 ' + want.join(', ') + ' 実際 ' + oct.join(', '));
  const months = [...new Set(oc.order.map((s) => oc.rows[s].section.replace(/\/.*/, '')))];
  if (months[months.length - 1] !== '時期未定') e.push('「時期未定」が最後でない: ' + months.join(', '));
  if (months[0] !== '2026年11月') e.push('先頭が 2026年11月でない: ' + months[0]);
});

// /daily/
const daily = get('daily/index.html');
check('/daily/: shopDate（日付まで確定）の日に状態の文言', (e) => {
  const cases = [['2026-09-21', 'fm-open', '開店日'], ['2026-10-19', 'fm-open-planned', '開店予定'], ['2026-09-27', 'fm-close', '閉店日'], ['2026-10-31', 'fm-close-planned', '閉店予定'],
    ['2026-09-28', 'fm-temp-close', '休業開始'], ['2026-09-18', 'fm-reopen', '営業再開'], ['2026-09-17', 'fm-renewal', 'リニューアル'], ['2026-10-01', 'fm-move', '移転'],
    ['2026-10-01', 'fm-popup', '期間限定出店'], ['2026-09-10', 'fm-open-unconf', '開店日（未確認）'], ['2026-10-19', 'legacy-open-future', '注目の日'], ['2026-10-15', 'notice-only', '注目の日']];
  for (const [d, slug, label] of cases) {
    const got = runDaily(daily, '?date=' + d).cards[slug];
    if (got !== label) e.push(d + ' ' + slug + ': 期待「' + label + '」 実際「' + got + '」');
  }
});
check('/daily/: 年月だけ・日付なし・実在しない日付は日に置かない', (e) => {
  const { posts } = runDaily(daily, '?date=2026-11-01');
  for (const slug of ['fm-open-planned-unconf', 'fm-planned-month-current', 'fm-nodate-open', 'fm-invalid-date', 'yaml-status']) {
    const p = posts.find((x) => x.url === '/posts/' + slug + '/');
    if (p.shopDay || (p.notableDates || []).length) e.push(slug + ' に日がある: ' + JSON.stringify(p.shopDay || p.notableDates));
  }
  const m = runDaily(daily, '?month=2026-11');
  if (m.cards['fm-open-planned-unconf'] !== undefined) e.push('年月だけの shopDate が月の一覧に入っている');
});
check('サイドバー: shopDate は日付まで確定したものだけ点灯', (e) => {
  const days = JSON.parse(strip(/<pre id="sidebar">([\s\S]*?)<\/pre>/.exec(get('index.html'))[1]));
  for (const d of ['2026-09-21', '2026-10-19', '2026-10-05', '2026-09-10']) if (!days.includes(d)) e.push(d + ' が点灯しない');
  for (const d of days) if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) e.push('日付でない値: ' + d);
  if (days.includes('2026-02-30')) e.push('実在しない日付が点灯');
  if (days.includes('2026-10-25')) e.push('yaml の date が点灯（日単位の機能は記事の shopDate だけ）');
});
check('/events/ に店舗記事が入らない（shopDate・期間限定・legacy の eventDate とも）', (e) => {
  const ev = get('events/index.html');
  for (const p of P) if (p.cat !== 'イベント' && ev.includes('/posts/' + p.slug + '/')) e.push(p.slug + ' が /events/ にある');
  if (!ev.includes('/posts/event-article/')) e.push('イベント記事が載っていない（テストの前提）');
});
check('Event JSON-LD が店舗記事に出ない（eventLocation があっても）', (e) => {
  for (const p of P) {
    const html = get('posts/' + p.slug + '/index.html');
    const has = /"@type":"Event"/.test(html);
    if (has !== (p.slug === 'event-article')) e.push(p.slug + ': Event ' + has);
  }
});
check('記事の通知: shopStatus の予定日経過だけに店舗の通知（legacy は従来の告知の通知のまま）', (e) => {
  const n = (s) => strip((/<div id="notice">([\s\S]*?)<\/div>\s*<div id="jsonld">/.exec(get('posts/' + s + '/index.html')) || ['', ''])[1]);
  if (!/2026年10月5日の開店予定としてお伝えしたもの/.test(n('fm-planned-passed-day'))) e.push('fm-planned-passed-day: ' + n('fm-planned-passed-day'));
  if (!/2026年9月の閉店予定としてお伝えしたもの/.test(n('fm-planned-month-past'))) e.push('fm-planned-month-past: ' + n('fm-planned-month-past'));
  for (const s of ['fm-open-planned', 'fm-planned-month-current', 'fm-open', 'yaml-status']) if (n(s)) e.push(s + ' に通知: ' + n(s));
  if (/お伝えしたもの/.test(n('legacy-planned-past')) || !n('legacy-planned-past')) e.push('legacy-planned-past: ' + n('legacy-planned-past'));
});

// ---- 日本時間の境目（10/31 の予定・2026-10 の予定） ----
for (const [now, label, passed] of [['2026-10-31T14:59:59Z', 'JST 10/31 23:59:59', false], ['2026-10-31T15:00:01Z', 'JST 11/1 00:00:01（UTC は 10/31）', true]]) {
  const o = parseOC(build(now)('open-close/index.html'));
  check('予定日経過の境目: ' + label, (e) => {
    for (const s of ['fm-close-planned', 'fm-planned-month-current']) if (o.rows[s].passed !== passed) e.push(s + ': 期待 ' + passed + ' 実際 ' + o.rows[s].passed);
    if (o.stats['開店'] !== 5) e.push('年が変わっていないのに開店の件数が変わった: ' + o.stats['開店']);
  });
}
check('年の境目: 日本時間で年が変わると件数の年も変わる', (e) => {
  const o = parseOC(build('2026-12-31T15:00:01Z')('open-close/index.html'));
  if (o.stats['開店'] !== 0) e.push('2027年の開店件数: ' + o.stats['開店']);
  const h = fs.readFileSync(path.join(DIR, 'public/open-close/index.html'), 'utf8');
  if (!/2027年の集計/.test(h)) e.push('集計の年が 2027 でない');
});

fs.rmSync(DIR, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
