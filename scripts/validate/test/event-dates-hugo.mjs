#!/usr/bin/env node
/*
 * 日付解釈の共通部品（layouts/partials/event-dates.html ほか）のテスト（工程1a PR 3）。リポジトリ直下で実行:
 *   node scripts/validate/test/event-dates-hugo.mjs            （hugo が PATH にある場合）
 *   HUGO=/path/to/hugo node scripts/validate/test/event-dates-hugo.mjs
 * 一時ディレクトリに最小の Hugo サイトを作り、リポジトリの partial をそのまま使って約40通りの記事をビルドし、
 * 解釈結果（spans・groups・days・notable・kind・ongoing・invalid）、記事カードの日付ラベル、終了通知、
 * イベント情報ボックスの表示を期待値と比べる。不正な値を含む記事があってもビルドが止まらないことも確かめる。
 * 本番と同じ Hugo 0.167.0 で確認している。依存ライブラリなし。失敗があれば終了コード 1。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const HUGO = process.env.HUGO || 'hugo';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'event-dates-'));
const w = (rel, text) => { const p = path.join(DIR, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };

// ---- 最小サイト ----
w('hugo.toml', [
  'baseURL = "https://example.test/"',
  'defaultContentLanguage = "ja"',
  'disableKinds = ["taxonomy", "term", "RSS", "sitemap", "robotsTXT", "404", "home", "section"]',
  '[languages.ja]', 'weight = 1', '[languages.en]', 'weight = 2', ''].join('\n'));
for (const f of ['date-ymd.html', 'event-dates.html', 'event-dates-text.html', 'card-dates.html', 'event-ended-notice.html']) {
  w('layouts/partials/' + f, fs.readFileSync(path.join(ROOT, 'layouts/partials', f), 'utf8'));
}
// 終了通知の文言は本番の i18n から取る
const i18n = (lang) => fs.readFileSync(path.join(ROOT, 'i18n', lang + '.yaml'), 'utf8').split(/\r?\n/)
  .reduce((acc, l, i, a) => (/^- id: (event_ended|past_notice)$/.test(l) ? acc + l + '\n' + a[i + 1] + '\n' : acc), '');
w('i18n/ja.yaml', i18n('ja'));
w('i18n/en.yaml', i18n('en'));
// 情報ボックスは single.html の該当部分を抜き出して使う（表示条件・hideEventBox の扱いも本番と同じ）
const single = fs.readFileSync(path.join(ROOT, 'layouts/single.html'), 'utf8');
const box = /(\{\{- if and \.Params\.eventDate \(not \.Params\.hideEventBox\) \}\}[\s\S]*?)\s*\{\{- \/\* 日付経過の通知/.exec(single);
if (!box) { console.error('single.html から情報ボックスを抜き出せません'); process.exit(2); }
w('layouts/_default/single.html', [
  '{{- $ev := partialCached "event-dates.html" . .RelPermalink -}}',
  '<pre id="ev">{{ $ev | jsonify }}</pre>',
  '<div id="card">{{ partial "card-dates.html" (dict "page" . "event" true) }}</div>',
  '<div id="notice">{{ partial "event-ended-notice.html" . }}</div>',
  '<div id="box">' + box[1] + '</div>', ''].join('\n'));

// ---- テストケース ----
// fm: 日付まわりの frontmatter（YAML の行）。cat: 1件目のカテゴリ（null なら categories なし）。date: 公開日
const CASES = [];
const c = (id, fm, expect, opt = {}) => CASES.push({ id, fm, expect, cat: opt.cat === undefined ? 'イベント' : opt.cat, date: opt.date || '2026-10-01', lang: opt.lang || 'ja', cats: opt.cats });
const S = (a, b) => ({ end: b || a, start: a }); // jsonify はキーを辞書順に並べる
const days = (a, b) => { const out = []; for (let t = Date.parse(a); t <= Date.parse(b); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10)); return out; };

// 基本の書式
c('単日', 'eventDate: "2026-10-17"', { spans: [S('2026-10-17')], count: 1, days: ['2026-10-17'], kind: 'event', card: '開催 10月17日(土)' });
c('連続期間（同じ月）', 'eventDate: "2026-08-14/2026-08-15"', { spans: [S('2026-08-14', '2026-08-15')], count: 1, days: days('2026-08-14', '2026-08-15'), card: '開催 8月14日(金)〜15日(土)' });
c('連続期間（月またぎ）', 'eventDate: "2026-09-28/2026-10-03"', { count: 1, days: days('2026-09-28', '2026-10-03'), card: '開催 9月28日(月)〜10月3日(土)' });
c('年またぎ', 'eventDate: "2026-12-28/2027-01-04"', { count: 1, days: days('2026-12-28', '2027-01-04'), card: '開催 12月28日(月)〜2027年1月4日(月)' });
c('公開日と別の年', 'eventDate: "2027-01-22"', { card: '開催 2027年1月22日(金)' });
c('うるう年', 'eventDate: "2028-02-28/2028-03-01"', { days: ['2028-02-28', '2028-02-29', '2028-03-01'], card: '開催 2月28日(月)〜3月1日(水)' }, { date: '2028-02-01' });
c('うるう年でない2月29日は不正', 'eventDate: "2027-02-29"', { spans: [], count: 0, invalid: 1, card: '' });
c('14日間は全日', 'eventDate: "2026-08-01/2026-08-14"', { days: days('2026-08-01', '2026-08-14') });
c('15日間は初日と最終日', 'eventDate: "2026-08-01/2026-08-15"', { days: ['2026-08-01', '2026-08-15'], card: '開催 8月1日(土)〜15日(土)' });
c('長期の期間', 'eventDate: "2026-09-01/2026-10-31"', { days: ['2026-09-01', '2026-10-31'], card: '開催 9月1日(火)〜10月31日(土)' });
// 複数日程
c('飛び飛び2日程', 'eventDates:\n  - "2026-10-25"\n  - "2026-11-03"', { count: 2, days: ['2026-10-25', '2026-11-03'], card: '開催 10月25日(日)・11月3日(火)' });
c('飛び飛び3日程', 'eventDates:\n  - "2026-09-01"\n  - "2026-09-13"\n  - "2026-09-26"', { count: 3, card: '開催 9月1日(火)・9月13日(日)・9月26日(土)' });
c('飛び飛び4日程', 'eventDates:\n  - "2026-10-25"\n  - "2026-11-01"\n  - "2026-11-08"\n  - "2026-11-15"', { count: 4, days: ['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15'], card: '開催 10月25日(日)ほか全4日程' });
c('連続日付だけの配列は1期間', 'eventDates:\n  - "2026-08-14"\n  - "2026-08-15"', { spans: [S('2026-08-14'), S('2026-08-15')], groups: [S('2026-08-14', '2026-08-15')], count: 1, card: '開催 8月14日(金)〜15日(土)' });
c('連続部分と飛び日の混在', 'eventDates:\n  - "2026-07-24"\n  - "2026-07-25"\n  - "2026-07-27"', { count: 2, days: ['2026-07-24', '2026-07-25', '2026-07-27'], card: '開催 7月24日(金)〜25日(土)・7月27日(月)' });
c('複数会期（期間の配列）', 'eventDates:\n  - "2026-09-14/2026-09-21"\n  - "2026-09-22/2026-09-30"', { count: 2, days: days('2026-09-14', '2026-09-30'), card: '開催 9月14日(月)〜21日(月)・9月22日(火)〜30日(水)' });
c('複数会期のうち長期の会期', 'eventDates:\n  - "2026-09-01/2026-09-03"\n  - "2026-10-01/2026-10-31"', { count: 2, days: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-10-01', '2026-10-31'] });
c('公開日と別の年の複数日程（2件目は年を省く）', 'eventDates:\n  - "2027-01-22"\n  - "2027-02-05"', { card: '開催 2027年1月22日(金)・2月5日(金)' });
c('年をまたぐ複数日程', 'eventDates:\n  - "2026-12-28"\n  - "2027-01-04"', { card: '開催 12月28日(月)・2027年1月4日(月)' });
c('年をまたぐ会期の次の日程', 'eventDates:\n  - "2026-12-28/2027-01-04"\n  - "2027-01-10"', { card: '開催 12月28日(月)〜2027年1月4日(月)・1月10日(日)' });
c('要素1つの eventDates', 'eventDates:\n  - "2026-05-09"', { count: 1, card: '開催 5月9日(土)' }, { date: '2026-05-01' });
c('同じ会期の重複', 'eventDates:\n  - "2026-09-01/2026-09-15"\n  - "2026-09-01/2026-09-15"\n  - "2026-09-20"', { count: 2, spans: [S('2026-09-01', '2026-09-15'), S('2026-09-20')] });
// 旧書式・型
c('引用符なしの日付', 'eventDate: 2026-06-07', { spans: [S('2026-06-07')], card: '開催 6月7日(日)' }, { date: '2026-06-01' });
c('引用符なしの日付の配列', 'eventDates:\n  - 2026-06-12\n  - 2026-06-18', { count: 2, card: '開催 6月12日(金)・6月18日(木)' }, { date: '2026-06-01' });
c('時刻付きの日付', 'eventDate: "2026-10-17T10:00:00+09:00"', { spans: [S('2026-10-17')], card: '開催 10月17日(土)' });
c('eventDate の配列（旧書式）', 'eventDate:\n  - "2026-09-01"\n  - "2026-09-13"\n  - "2026-09-26"', { count: 3, card: '開催 9月1日(火)・9月13日(日)・9月26日(土)' });
c('eventDate と eventDates に同じ日', 'eventDate: "2026-10-17"\neventDates:\n  - "2026-10-17"', { spans: [S('2026-10-17')], count: 1, card: '開催 10月17日(土)' });
c('eventDate と eventDates に別の日', 'eventDate: "2026-10-17"\neventDates:\n  - "2026-10-24"', { count: 2, card: '開催 10月17日(土)・10月24日(土)' });
c('eventEndDate で終了日を上書き', 'eventDate: "2026-10-17"\neventEndDate: "2026-10-18"', { spans: [S('2026-10-17', '2026-10-18')], card: '開催 10月17日(土)〜18日(日)' });
c('空白入りの期間', 'eventDate: "2026-10-01 / 2026-10-03"', { spans: [S('2026-10-01', '2026-10-03')] });
// 終了日未定
c('終了日未定（イベント）', 'eventDate: "2026-08-26"\neventOngoing: true', { ongoing: true, days: ['2026-08-26'], card: '開催 8月26日(水)から（終了日未定）' }, { date: '2026-08-20' });
c('終了日未定（店舗の一時休業）', 'eventDate: "2026-09-01"\neventOngoing: true', { ongoing: true, kind: '', card: '' }, { cat: '開店・閉店', date: '2026-08-04' });
// 種別
c('スポーツは試合日', 'eventDate: "2026-10-10"', { kind: 'match', kindSource: 'category', card: '試合日 10月10日(土)' }, { cat: 'スポーツ' });
c('eventKind: match を優先', 'eventKind: "match"\neventDate: "2026-10-10"', { kind: 'match', kindSource: 'eventKind', card: '試合日 10月10日(土)' }, { cat: '子育て・教育' });
c('eventKind: fair', 'eventKind: "fair"\neventDate: "2026-09-01/2026-10-31"', { kind: 'fair', card: '期間 9月1日(火)〜10月31日(土)' }, { cat: 'グルメ・カフェ' });
c('eventKind: event（お知らせ）', 'eventKind: "event"\neventDate: "2026-10-10"', { kind: 'event', card: '開催 10月10日(土)' }, { cat: 'お知らせ' });
c('不正な eventKind は無視してカテゴリで推定', 'eventKind: "festival"\neventDate: "2026-10-10"', { kind: 'event', kindSource: 'category' });
for (const cat of ['子育て・教育', 'グルメ・カフェ', '開店・閉店', 'お知らせ', 'ニュース']) {
  c('推定しないカテゴリ: ' + cat, 'eventDate: "2026-10-10"', { kind: '', card: '', days: ['2026-10-10'] }, { cat });
}
c('カテゴリなし', 'eventDate: "2026-10-10"', { kind: '', card: '' }, { cat: null });
c('翻訳版（英語）にはラベルを出さない', 'eventDate: "2026-10-10"', { kind: 'event', card: '' }, { lang: 'en' });
// 不正な値（除外し、ビルドを止めない）
c('実在しない日付', 'eventDate: "2026-02-30"', { spans: [], days: [], invalid: 1, card: '' });
c('実在しない月', 'eventDate: "2026-13-01"', { spans: [], invalid: 1 });
c('逆順の期間', 'eventDate: "2026-10-05/2026-10-01"', { spans: [], invalid: 1, card: '' });
c('〜 区切り', 'eventDate: "2026-10-01〜2026-10-03"', { spans: [], invalid: 1 });
c('カンマ区切り', 'eventDate: "2026-10-01,2026-10-03"', { spans: [], invalid: 1 });
c('YYYY/MM/DD', 'eventDate: "2026/10/01"', { spans: [], invalid: 1 });
c('区切りが3つ以上', 'eventDate: "2026-10-01/2026-10-02/2026-10-03"', { spans: [], invalid: 1 });
c('和文の日付', 'eventDate: "10月1日"', { spans: [], invalid: 1 });
c('空の値', 'eventDate: ""', { spans: [], invalid: 0, card: '' });
c('配列の中の不正な要素だけ除く', 'eventDates:\n  - "2026-10-25"\n  - "2026-02-30"\n  - "2026-11-03"', { count: 2, invalid: 1, card: '開催 10月25日(日)・11月3日(火)' });
c('配列の中の範囲要素', 'eventDate:\n  - "2026-10-01/2026-10-02"\n  - "2026-10-10"', { count: 2, card: '開催 10月1日(木)〜2日(金)・10月10日(土)' });
c('eventDates が文字列', 'eventDates: "2026-10-25"', { spans: [], invalid: 1, card: '' });
c('不正な eventEndDate は無視', 'eventDate: "2026-10-17"\neventEndDate: "2026-10-10"', { spans: [S('2026-10-17')], invalid: 1 });
// イベントではない注目の日
c('notableDate・shopDate・openDate', 'notableDate: "2026-11-01"\nnotableDates:\n  - "2026-11-02"\n  - "2026-11-03"\nshopDate: "2026-11-04"\nopenDate: "2026-11-05"\ncloseDate: "2026-11-06"',
  { spans: [], notable: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'], card: '' }, { cat: 'お知らせ' });
c('shopDate の年月は日付にしない', 'shopDate: "2026-11"', { notable: [], invalid: 0 }, { cat: '開店・閉店' });
c('notableDates が文字列', 'notableDates: "2026-11-02"', { notable: [], invalid: 1 }, { cat: 'お知らせ' });
c('不正な notableDate', 'notableDate: "2026-02-30"', { notable: [] }, { cat: 'お知らせ' });

// 終了通知（now に依存しないよう、過去は2020年・未来は2099年の日付で確かめる）
const ENDED = 'このイベントは終了しました', PAST = 'より前に掲載した告知です';
c('通知: 終了したイベント', 'eventDate: "2020-06-01/2020-06-02"', { notice: ENDED + '（2020-06-02）' }, { date: '2020-05-01' });
c('通知: 終了したイベント（eventDates だけ）', 'eventDates:\n  - "2020-06-01"\n  - "2020-06-08"', { notice: ENDED + '（2020-06-08）' }, { date: '2020-05-01' });
c('通知: 今後の日程が残る複数日程', 'eventDates:\n  - "2020-06-01"\n  - "2099-06-08"', { notice: '' }, { date: '2020-05-01' });
c('通知: 終了日未定は出さない', 'eventDate: "2020-06-01"\neventOngoing: true', { notice: '' }, { date: '2020-05-01' });
c('通知: 試合の予告（eventDates だけ）', 'eventDates:\n  - "2020-06-01"\n  - "2020-06-08"', { notice: '2020-06-08' + PAST }, { cat: 'スポーツ', date: '2020-05-01' });
c('通知: 試合の結果記事（事後）には出さない', 'eventDate: "2020-06-01"', { notice: '' }, { cat: 'スポーツ', date: '2020-06-02' });
c('通知: 推定しないカテゴリの eventDates だけには出さない', 'eventDates:\n  - "2020-06-01"\n  - "2020-06-08"', { notice: '' }, { cat: '子育て・教育', date: '2020-05-01' });
c('通知: お知らせの eventDate（従来どおり告知の通知）', 'eventDate: "2020-06-01"', { notice: '2020-06-01' + PAST }, { cat: 'お知らせ', date: '2020-05-01' });
c('通知: notableDate だけには出さない', 'notableDate: "2020-06-01"', { notice: '' }, { cat: 'お知らせ', date: '2020-05-01' });
c('通知: 2番目以降のカテゴリが イベント', 'eventDate: "2020-06-01"', { notice: ENDED + '（2020-06-01）' }, { cats: ['スポーツ', 'イベント'], date: '2020-05-01' });
c('通知: 不正な日付では出さない（ビルドも止めない）', 'eventDate: "2020-02-30"', { notice: '' }, { date: '2020-01-01' });
c('通知: 翻訳版', 'eventDate: "2020-06-01"', { notice: '2020-06-01' }, { lang: 'en', date: '2020-05-01' });

// 情報ボックス（hideEventBox が無い記事だけ）
c('情報ボックス: 整形して表示', 'eventDate: "2026-10-17/2026-10-18"\nhideEventBox: false', { box: '開催日2026年10月17日(土)〜18日(日)' }, { box: true });
c('情報ボックス: 複数日程', 'eventDate: "2026-10-25"\neventDates:\n  - "2026-11-03"\nhideEventBox: false', { box: '開催日2026年10月25日(日)・11月3日(火)' }, { box: true });
c('情報ボックス: 試合日', 'eventDate: "2026-10-17"\nhideEventBox: false', { box: '試合日2026年10月17日(土)' }, { cat: 'スポーツ', box: true });
c('情報ボックス: 不正な日付は出さない', 'eventDate: "2026-02-30"\nhideEventBox: false', { box: '' }, { box: true });

// ---- 記事を書き出してビルド ----
CASES.forEach((k, i) => {
  const id = String(i + 1).padStart(3, '0');
  k.slug = 't' + id;
  const cats = k.cats || (k.cat ? [k.cat] : null);
  const box = /hideEventBox/.test(k.fm) ? '' : 'hideEventBox: true\n';
  const text = '---\ntitle: "' + k.id + '"\ndate: ' + k.date + 'T10:00:00+09:00\nslug: "' + k.slug + '"\n'
    + (cats ? 'categories:\n' + cats.map((x) => '  - "' + x + '"\n').join('') : '') + k.fm + '\n' + box + '---\n本文\n';
  w('content/posts/' + k.slug + (k.lang === 'ja' ? '' : '.' + k.lang) + '.md', text);
});
const r = spawnSync(HUGO, ['--source', DIR, '--destination', path.join(DIR, 'public'), '--buildFuture', '--quiet'], { encoding: 'utf8' });
let pass = 0, fail = 0;
if (r.status !== 0) {
  console.log('  FAIL Hugo のビルドが失敗しました（不正な値でビルドが止まってはいけない）\n' + (r.stderr || r.stdout || r.error));
  process.exit(1);
}
console.log('  ok   ' + CASES.length + ' 本の記事（不正な値を含む）でビルドが成功');
pass++;

const text = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const k of CASES) {
  const file = path.join(DIR, 'public', k.lang === 'ja' ? '' : k.lang, 'posts', k.slug, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const ev = JSON.parse(/<pre id="ev">([\s\S]*?)<\/pre>/.exec(html)[1].replace(/&#34;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  const cardHtml = /<div id="card">([\s\S]*?)<\/div>/.exec(html)[1];
  const label = /<span class="card-event[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(cardHtml);
  const got = {
    spans: ev.spans, groups: ev.groups, count: ev.count, days: ev.days, notable: ev.notable, kind: ev.kind, kindSource: ev.kindSource,
    ongoing: ev.ongoing, invalid: ev.invalid,
    card: label ? text(label[1]) : '',
    notice: text(/<div id="notice">([\s\S]*?)<\/div>\s*<div id="box">/.exec(html)[1]),
    box: text((/<dl>([\s\S]*?)<\/dl>/.exec(/<div id="box">([\s\S]*)$/.exec(html)[1]) || [, ''])[1]),
  };
  const errs = [];
  for (const [key, want] of Object.entries(k.expect)) {
    if (key === 'notice' || key === 'box') {
      if (want === '' ? got[key] !== '' : !got[key].includes(want)) errs.push(key + ': 期待 ' + JSON.stringify(want) + ' 実際 ' + JSON.stringify(got[key]));
    } else if (!eq(got[key], want)) errs.push(key + ': 期待 ' + JSON.stringify(want) + ' 実際 ' + JSON.stringify(got[key]));
  }
  // カードに公開日が常に出ていること、ラベルがあるときだけ「公開」が付くこと
  const pub = /<time datetime="(\d{4}-\d{2}-\d{2})">([^<]*)<\/time>\s*$/.exec(cardHtml.trim());
  if (!pub || pub[1] !== k.date) errs.push('公開日の <time> が無いか日付が違う');
  else if (/^公開 /.test(pub[2]) !== !!label) errs.push('「公開」の付き方が違う: ' + pub[2]);
  if (errs.length) { fail++; console.log('  FAIL ' + k.id + '\n       ' + errs.join('\n       ')); }
  else { pass++; console.log('  ok   ' + k.id); }
}
fs.rmSync(DIR, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
