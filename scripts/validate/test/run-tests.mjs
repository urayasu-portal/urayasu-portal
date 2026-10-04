#!/usr/bin/env node
/*
 * static/tools/post-rules.js のテスト。リポジトリ直下で実行:
 *   node scripts/validate/test/run-tests.mjs
 * 依存ライブラリなし。失敗があれば終了コード 1。
 *
 * 後半の「既存記事の回帰テスト」は content/posts の全記事を実際に読み、
 * 新しいルールが従来の正しい記事を不必要にブロックしないことを確認する。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const R = require(path.join(ROOT, 'static/tools/post-rules.js'));

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
};
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); };
const codes = (list) => list.map((x) => x.code).sort();
const NOW = Date.parse('2026-10-04T12:00:00+09:00');
const v = (text, extra) => R.validatePost(text, Object.assign({ path: 'content/posts/20261004-example-slug.md', isNew: true, now: NOW, skipBodyChecks: true }, extra || {}));

const GOOD = [
  '---',
  'title: "【浦安市】テスト記事、10月4日に開催"',
  'date: 2026-10-04T10:00:00+09:00',
  'slug: "example-slug"',
  'categories:',
  '  - "イベント"',
  'tags:',
  '  - "浦安市"',
  'description: "説明文です。"',
  'eventDate: "2026-10-10"',
  'hideEventBox: true',
  'sources:',
  '  - name: "浦安市公式"',
  '    url: "https://www.city.urayasu.lg.jp/"',
  'draft: false',
  '---',
  '<p>本文</p>',
  ''
].join('\n');
const replaceLine = (text, from, to) => text.split('\n').map((l) => (l.startsWith(from) ? to : l)).filter((l) => l !== null).join('\n');

console.log('■ 解析（BOM・改行・配列・引用符）');
t('正常な記事（LF）はエラーなし', () => { const r = v(GOOD); eq(codes(r.errors), []); eq(codes(r.warnings), []); });
t('BOM＋CRLF でも同じ結果になり、BOM を通知する', () => {
  const r = v('﻿' + GOOD.replace(/\n/g, '\r\n'));
  eq(codes(r.errors), []); eq(codes(r.info), ['FM_BOM']);
  eq(r.fm.data.title, '【浦安市】テスト記事、10月4日に開催');
  eq(r.fm.hadCrlf, true);
});
t('CR のみの改行でも解析できる', () => { eq(codes(v(GOOD.replace(/\n/g, '\r')).errors), []); });
t('ブロック形式の categories を配列で読む', () => { eq(v(GOOD).fm.data.categories, ['イベント']); });
t('インライン形式の categories を配列で読む', () => {
  const r = v(replaceLine(GOOD, 'categories:', 'categories: ["イベント", \'お知らせ\']').replace('\n  - "イベント"', ''));
  eq(r.fm.data.categories, ['イベント', 'お知らせ']); eq(codes(r.errors), []);
});
t('インライン形式でも許可外カテゴリを検出', () => {
  const r = v(replaceLine(GOOD, 'categories:', 'categories: ["グルメ"]').replace('\n  - "イベント"', ''));
  eq(codes(r.errors), ['CATEGORY_NOT_ALLOWED']);
});
t('ブロック形式の許可外カテゴリを検出（cat- も含む）', () => {
  eq(codes(v(GOOD.replace('  - "イベント"', '  - "グルメ"')).errors), ['CATEGORY_NOT_ALLOWED']);
  eq(codes(v(GOOD.replace('  - "イベント"', '  - cat-open')).errors), ['CATEGORY_NOT_ALLOWED']);
});
t('引用符を含むタイトル（エスケープ・全角かぎ括弧・シングル）', () => {
  eq(v(replaceLine(GOOD, 'title:', 'title: "【浦安】\\"A\\"と「B」"')).fm.data.title, '【浦安】"A"と「B」');
  eq(v(replaceLine(GOOD, 'title:', "title: 'It''s 浦安'")).fm.data.title, "It's 浦安");
  /* YAML の仕様どおり「空白＋#」以降はコメント */
  eq(v(replaceLine(GOOD, 'title:', 'title: 浦安#1の話 # コメント')).fm.data.title, '浦安#1の話');
});
t('日本語のプレーン文字列', () => { eq(v(replaceLine(GOOD, 'description:', 'description: 浦安・舞浜の情報です')).fm.data.description, '浦安・舞浜の情報です'); });
t('開始区切りが無い → FM_NO_START', () => { eq(codes(v(GOOD.replace(/^---\n/, '')).errors), ['FM_NO_START']); });
t('前置きの文章がある → FM_NO_START', () => { eq(codes(v('■ .mdファイル内容\n' + GOOD).errors), ['FM_NO_START']); });
t('終了区切りが無い → FM_NO_END', () => { eq(codes(v(GOOD.replace('draft: false\n---', 'draft: false')).errors), ['FM_NO_END']); });
t('閉じていないクォート（実在した不備の再現）→ FM_SYNTAX', () => {
  const r = v(replaceLine(GOOD, 'description:', 'description: "南行徳駅近くに「キッチンオリジン」が新規開店しています。'));
  if (!codes(r.errors).includes('FM_SYNTAX')) throw new Error('FM_SYNTAX が出ない: ' + JSON.stringify(r.errors));
});
t('項目の重複 → FM_SYNTAX', () => { eq(codes(v(GOOD.replace('draft: false', 'draft: false\nslug: "x"')).errors), ['FM_SYNTAX']); });
t('タブ字下げ → FM_SYNTAX', () => { if (!codes(v(GOOD.replace('  - "イベント"', '\t- "イベント"')).errors).includes('FM_SYNTAX')) throw new Error('FM_SYNTAX が出ない'); });
t('ネストしたマップ（cover・sources・faq）は誤検出しない', () => {
  const r = v(GOOD.replace('draft: false', 'cover:\n  image: "/images/a.jpg"\n  alt: "a"\nfaq:\n  - q: "質問？"\n    a: "回答。"\ndraft: false'));
  eq(codes(r.errors), []);
});

console.log('■ 必須項目');
t('title なし → TITLE_MISSING', () => { eq(codes(v(replaceLine(GOOD, 'title:', 'title: ""')).errors), ['TITLE_MISSING']); });
t('新規で slug なし → SLUG_MISSING', () => { eq(codes(v(replaceLine(GOOD, 'slug:', '#')).errors), ['SLUG_MISSING']); });
t('既存記事の更新で slug なしはブロックしない（後方互換）', () => { eq(codes(v(replaceLine(GOOD, 'slug:', '#'), { isNew: false }).errors), []); });
t('url 指定があれば slug なしでも新規可', () => { eq(codes(v(replaceLine(GOOD, 'slug:', 'url: "/posts/x/"')).errors), []); });
t('slug 形式不正（新規はエラー・更新は警告）', () => {
  eq(codes(v(replaceLine(GOOD, 'slug:', 'slug: "Trial_Seiyu"')).errors), ['SLUG_FORMAT']);
  const u = v(replaceLine(GOOD, 'slug:', 'slug: "Trial_Seiyu"'), { isNew: false, skipLastmodChecks: true });
  eq(codes(u.errors), []); eq(codes(u.warnings), ['SLUG_FORMAT']);
  eq(codes(v(replaceLine(GOOD, 'slug:', 'slug: "-a-"')).errors), ['SLUG_FORMAT']);
});
t('ja の新規で categories なし → CATEGORY_MISSING', () => { eq(codes(v(GOOD.replace('categories:\n  - "イベント"\n', '')).errors), ['CATEGORY_MISSING']); });
t('翻訳版（.en.md）は categories なしでよい', () => {
  eq(codes(v(GOOD.replace('categories:\n  - "イベント"\n', ''), { path: 'content/posts/20261004-example-slug.en.md' }).errors), []);
});
t('draft なし → DRAFT_MISSING / draft: true → DRAFT_TRUE', () => {
  eq(codes(v(GOOD.replace('draft: false\n', '')).errors), ['DRAFT_MISSING']);
  eq(codes(v(GOOD.replace('draft: false', 'draft: true')).errors), ['DRAFT_TRUE']);
});
t('eventDate があって hideEventBox なし → EVENT_HIDEBOX', () => { eq(codes(v(GOOD.replace('hideEventBox: true\n', '')).errors), ['EVENT_HIDEBOX']); });
t('eventDate の形式（範囲は可・配列は警告・不正はエラー）', () => {
  eq(codes(v(GOOD.replace('eventDate: "2026-10-10"', 'eventDate: "2026-10-10/2026-10-12"')).warnings), []);
  eq(codes(v(GOOD.replace('eventDate: "2026-10-10"', 'eventDate:\n  - "2026-10-10"\n  - "2026-10-11"')).warnings), ['EVENTDATE_ARRAY']);
  eq(codes(v(GOOD.replace('eventDate: "2026-10-10"', 'eventDate: "10月10日"')).errors), ['EVENTDATE_FORMAT']);
});

/* ── 開催日（eventDate / eventDates）の形式・実在性（工程1a PR 1a-1） ── */
console.log('■ 開催日（eventDate / eventDates）');
const withEv = (lines) => GOOD.replace('eventDate: "2026-10-10"', lines);
const ev = (lines, extra) => v(withEv(lines), extra);
const errs = (lines, extra) => codes(ev(lines, extra).errors);
const warns = (lines, extra) => codes(ev(lines, extra).warnings);
const infos = (lines, extra) => codes(ev(lines, extra).info);
const list = (key, items) => key + ':\n' + items.map((x) => '  - "' + x + '"').join('\n');
t('正しい単日 → 通過', () => { eq(errs('eventDate: "2026-11-19"'), []); eq(warns('eventDate: "2026-11-19"'), []); });
t('正しい連続期間 → 通過', () => { eq(errs('eventDate: "2026-10-23/2026-10-31"'), []); eq(warns('eventDate: "2026-10-23/2026-10-31"'), []); });
t('正しい飛び飛びの日程（eventDates）→ 通過', () => {
  eq(errs(list('eventDates', ['2026-10-25', '2026-11-03'])), []); eq(warns(list('eventDates', ['2026-10-25', '2026-11-03'])), []);
});
t('複数の連続期間を持つ eventDates（会期の列挙）→ 通過', () => {
  const l = list('eventDates', ['2026-09-14/2026-09-21', '2026-09-22/2026-09-30']);
  eq(errs(l), []); eq(warns(l), []);
});
t('連続した日だけの eventDates → 通過（情報のみ）', () => {
  const l = list('eventDates', ['2026-08-14', '2026-08-15']);
  eq(errs(l), []); eq(warns(l), []); eq(infos(l), ['EVENTDATES_CONSECUTIVE']);
});
t('うるう年の 2月29日 → 通過', () => { eq(errs('eventDate: "2028-02-29"'), []); });
t('平年の 2月29日 → エラー', () => { eq(errs('eventDate: "2027-02-29"'), ['EVENTDATE_INVALID']); });
t('2月30日・13月 → エラー', () => {
  eq(errs('eventDate: "2026-02-30"'), ['EVENTDATE_INVALID']);
  eq(errs('eventDate: "2026-13-01"'), ['EVENTDATE_INVALID']);
  eq(errs('eventDate: "2026-10-01/2026-02-30"'), ['EVENTDATE_INVALID']);
});
t('逆順の期間 → エラー', () => { eq(errs('eventDate: "2026-10-20/2026-10-01"'), ['EVENTDATE_REVERSED']); });
t('不正な区切り文字（〜・～・~・カンマ・読点）→ エラー', () => {
  ['2026-10-01〜2026-10-10', '2026-10-01～2026-10-10', '2026-10-01~2026-10-10', '2026-10-01,2026-10-10', '2026-10-01、2026-10-10']
    .forEach((x) => eq(errs('eventDate: "' + x + '"'), ['EVENTDATE_SEPARATOR'], x));
});
t('3区切り以上の期間 → エラー', () => { eq(errs('eventDate: "2026-10-01/2026-10-10/2026-10-20"'), ['EVENTDATE_TOO_MANY_PARTS']); });
t('期間の区切りの前後の空白 → エラー（Hugo のビルドが止まるため）', () => {
  eq(errs('eventDate: "2026-10-19 / 2026-10-20"'), ['EVENTDATE_SPACED']);
  eq(errs('eventDate: " 2026-10-19"'), ['EVENTDATE_SPACED']);
});
t('日付として読めない値（日本語・スラッシュ日付・全角・空）→ エラー', () => {
  eq(errs('eventDate: "10月1日"'), ['EVENTDATE_FORMAT']);
  eq(errs('eventDate: "2026/10/01"'), ['EVENTDATE_FORMAT']);
  eq(errs('eventDate: "２０２６-１０-０１"'), ['EVENTDATE_FORMAT']);
  eq(errs('eventDate: ""'), ['EVENTDATE_EMPTY']);
  eq(errs('eventDate: true'), ['EVENTDATE_FORMAT']);
});
t('配列内の不正な要素 → エラー（どの要素かを示す）', () => {
  const r = ev(list('eventDates', ['2026-10-01', '2026-02-30']));
  eq(codes(r.errors), ['EVENTDATES_INVALID']);
  if (!/eventDates の2番目/.test(r.errors[0].msg)) throw new Error(r.errors[0].msg);
  eq(errs(list('eventDates', ['2026-10-10/2026-10-01'])), ['EVENTDATES_REVERSED']);
  eq(errs(list('eventDates', ['2026-10-01', '10月3日'])), ['EVENTDATES_FORMAT']);
  eq(errs('eventDates:\n  - "2026-10-01"\n  - ""'), ['EVENTDATES_EMPTY']);
  eq(errs(list('eventDate', ['2026-10-01', '2026-02-30'])), ['EVENTDATE_INVALID']);
  /* eventDate の配列要素に期間を書くと Hugo の終了通知でビルドが止まる */
  eq(errs(list('eventDate', ['2026-10-01/2026-10-03'])), ['EVENTDATE_RANGE_NOT_ALLOWED']);
});
t('eventDates がリストでない・空 → エラー', () => {
  eq(errs('eventDates: "2026-10-01"'), ['EVENTDATES_NOT_LIST']);
  eq(errs('eventDates: []'), ['EVENTDATES_EMPTY']);
});
t('eventDate の既存配列形式 → 警告のみ', () => {
  eq(errs(list('eventDate', ['2026-09-01', '2026-09-13', '2026-09-26'])), []);
  eq(warns(list('eventDate', ['2026-09-01', '2026-09-13', '2026-09-26'])), ['EVENTDATE_ARRAY']);
});
t('eventDates の1要素配列 → 警告のみ', () => { eq(errs(list('eventDates', ['2026-10-17'])), []); eq(warns(list('eventDates', ['2026-10-17'])), ['EVENTDATES_SINGLE']); });
t('eventDates の未整列・重複 → 警告のみ', () => {
  eq(warns(list('eventDates', ['2026-11-03', '2026-10-25'])), ['EVENTDATES_UNSORTED']);
  eq(warns(list('eventDates', ['2026-10-25', '2026-10-25', '2026-11-03'])), ['EVENTDATES_DUPLICATE']);
});
t('eventDate と eventDates の併用 → 警告（同じ日付なら情報）', () => {
  eq(errs('eventDate: "2026-10-17"\n' + list('eventDates', ['2026-10-17', '2026-10-18'])), []);
  eq(warns('eventDate: "2026-10-17"\n' + list('eventDates', ['2026-10-17', '2026-10-18'])), ['EVENT_BOTH']);
  const same = 'eventDate: "2026-10-17"\n' + list('eventDates', ['2026-10-17']);
  eq(errs(same), []); eq(infos(same), ['EVENT_BOTH_SAME']);
});
t('時刻付きの eventDate → 警告のみ（ビルドは通るが時刻は使われない）', () => {
  eq(errs('eventDate: "2026-10-19T10:00:00+09:00"'), []); eq(warns('eventDate: "2026-10-19T10:00:00+09:00"'), ['EVENTDATE_HAS_TIME']);
});
t('引用符なしの eventDate（YAML の日付型）→ 通過', () => { eq(errs('eventDate: 2026-06-07'), []); eq(warns('eventDate: 2026-06-07'), []); });
t('eventDate（単日）＋ eventOngoing: true → 通過（終了日が無いことをエラーにしない）', () => {
  eq(errs('eventDate: "2026-09-01"\neventOngoing: true'), []); eq(warns('eventDate: "2026-09-01"\neventOngoing: true'), []);
});
t('eventOngoing: true と終了日のある期間 → 警告（終了日判明時は eventOngoing を削除）', () => {
  eq(errs('eventDate: "2026-09-01/2026-09-30"\neventOngoing: true'), []);
  eq(warns('eventDate: "2026-09-01/2026-09-30"\neventOngoing: true'), ['EVENTONGOING_WITH_RANGE']);
});
t('開店記事・スポーツ記事に正しい eventDate → 通過（カテゴリで用途を制限しない）', () => {
  eq(codes(v(GOOD.replace('  - "イベント"', '  - "開店・閉店"').replace('eventDate: "2026-10-10"', 'eventDate: "2026-10-20"')).errors), []);
  eq(codes(v(GOOD.replace('  - "イベント"', '  - "スポーツ"').replace('eventDate: "2026-10-10"', 'eventDate: "2026-10-11"')).errors), []);
  eq(codes(v(GOOD.replace('  - "イベント"', '  - "お知らせ"').replace('eventDate: "2026-10-10"', 'eventDate: "2026-11-19"')).warnings), []);
});

console.log('■ 開催日（既存記事の更新）');
/* 既存記事に不正な値があっても、その項目を変えていない更新（本文・lastmod だけの続報）は止めない */
const OLD_BAD = withEv('eventDate: "2026-02-30"');
const upd = (newText, prevText) => R.validatePost(newText, { path: 'content/posts/20261004-example-slug.md', isNew: false, now: NOW, skipBodyChecks: true, prevText });
const addLastmod = (text) => text.replace('draft: false', 'lastmod: 2026-10-05T10:00:00+09:00\ndraft: false');
t('本文・lastmod だけの更新 → 通過（既存の不正な値は警告に下げる）', () => {
  const r = upd(addLastmod(OLD_BAD).replace('<p>本文</p>', '<p>本文</p><p>追記</p>'), OLD_BAD);
  eq(codes(r.errors), []); eq(codes(r.warnings), ['EVENTDATE_INVALID']);
  if (!/変更されていない/.test(r.warnings[0].msg)) throw new Error(r.warnings[0].msg);
});
t('正しい記事の本文・lastmod だけの更新 → 通過（警告なし）', () => {
  const r = upd(addLastmod(GOOD), GOOD); eq(codes(r.errors), []); eq(codes(r.warnings), []);
});
t('対象の日付を不正な値に変更した更新 → エラー', () => {
  eq(codes(upd(addLastmod(withEv('eventDate: "2026-02-30"')), GOOD).errors), ['EVENTDATE_INVALID']);
  eq(codes(upd(addLastmod(withEv('eventDate: "2026-10-20/2026-10-01"')), GOOD).errors), ['EVENTDATE_REVERSED']);
});
t('更新で eventDates を新しく追加して不正 → エラー', () => {
  eq(codes(upd(addLastmod(GOOD.replace('hideEventBox: true', list('eventDates', ['2026-10-10', '2026-13-01']) + '\nhideEventBox: true')), GOOD).errors), ['EVENTDATES_INVALID']);
});
t('終了日判明で単日＋eventOngoing を期間に変える更新 → 通過', () => {
  const before = withEv('eventDate: "2026-09-01"\neventOngoing: true');
  eq(codes(upd(addLastmod(withEv('eventDate: "2026-09-01/2026-10-31"')), before).errors), []);
});
t('既存記事の内容が読めない更新 → 新規と同じく厳格に検証し、その旨を警告', () => {
  const r = upd(addLastmod(OLD_BAD), '');
  eq(codes(r.errors), ['EVENTDATE_INVALID']); if (!codes(r.warnings).includes('EVENT_PREV_UNAVAILABLE')) throw new Error(JSON.stringify(r.warnings));
});
t('書き方（クォートの有無）だけの違いは「変更なし」として扱う', () => {
  const r = upd(addLastmod(withEv('eventDate: 2026-02-30')), OLD_BAD); eq(codes(r.errors), []);
});
t('意図的な予約投稿 → 従来どおり警告・確認（開催日の検証とは独立）', () => {
  const r = v(replaceLine(GOOD, 'date:', 'date: 2026-10-05T19:00:00+09:00').replace('20261004', '20261005'), { path: 'content/posts/20261005-example-slug.md' });
  eq(codes(r.errors), []); eq(codes(r.warnings), ['DATE_FUTURE']);
});
t('date・lastmod の検証は開催日の検証と分離（不正な開催日でも date の判定は変わらない）', () => {
  const r = v(withEv('eventDate: "2026-02-30"'));
  eq(codes(r.errors), ['EVENTDATE_INVALID']); eq(r.date && r.date.jst.d, 4);
});

/* ── 新しい日付・店舗情報の項目（工程1a PR 1a-2） ── */
console.log('■ 新項目（eventKind・notableDate(s)・shopStatus・shopDate・shopUnconfirmed・calendar）');
/* 開店・閉店記事の例。現行プロンプト v20260907 どおり eventDate（開店日）も持つ */
const SHOP = GOOD.replace('  - "イベント"', '  - "開店・閉店"').replace('eventDate: "2026-10-10"', 'eventDate: "2026-10-20"');
const withNew = (lines, base) => (base || SHOP).replace('hideEventBox: true', lines + '\nhideEventBox: true');
const nerr = (lines, base) => codes(v(withNew(lines, base)).errors);
const nwarn = (lines, base) => codes(v(withNew(lines, base)).warnings);
t('新項目が無い記事 → 従来どおり（新しいエラー・警告なし）', () => { eq(codes(v(SHOP).errors), []); eq(codes(v(SHOP).warnings), []); eq(codes(v(GOOD).warnings), []); });
t('eventKind の正常値3種類 → 通過', () => { R.EVENT_KINDS.forEach((k) => { eq(nerr('eventKind: "' + k + '"', GOOD), [], k); eq(nwarn('eventKind: "' + k + '"', GOOD), [], k); }); eq(R.EVENT_KINDS, ['event', 'match', 'fair']); });
t('eventKind の不正な値 → エラー', () => {
  ['festival', 'Event', '', 'イベント'].forEach((k) => eq(nerr('eventKind: "' + k + '"', GOOD), ['EVENTKIND_INVALID'], k));
  eq(nerr('eventKind: true', GOOD), ['EVENTKIND_INVALID']);
});
t('shopStatus の正常値9種類 → 通過', () => {
  eq(R.SHOP_STATUSES, ['open', 'open_planned', 'close', 'close_planned', 'temp_close', 'reopen', 'renewal', 'move', 'feature']);
  R.SHOP_STATUSES.forEach((s) => { eq(nerr('shopStatus: "' + s + '"'), [], s); eq(nwarn('shopStatus: "' + s + '"'), [], s); });
  eq(nerr('shopStatus: open'), []);
});
t('shopStatus の不正な値 → エラー', () => { ['opened', 'OPEN', 'closed', '開店', ''].forEach((s) => eq(nerr('shopStatus: "' + s + '"'), ['SHOPSTATUS_INVALID'], s)); });
t('notableDate の正常な日付 → 通過（引用符なしも可）', () => { eq(nerr('notableDate: "2026-11-19"'), []); eq(nerr('notableDate: 2026-11-19'), []); });
t('notableDate の不正な日付・形式 → エラー', () => {
  eq(nerr('notableDate: "2026-02-30"'), ['NOTABLEDATE_INVALID']);
  eq(nerr('notableDate: "2026-13-01"'), ['NOTABLEDATE_INVALID']);
  eq(nerr('notableDate: "11月19日"'), ['NOTABLEDATE_FORMAT']);
  eq(nerr('notableDate: "2026-11-19/2026-11-20"'), ['NOTABLEDATE_RANGE_NOT_ALLOWED']);
  eq(nerr('notableDate: "2026-11-19T10:00:00+09:00"'), ['NOTABLEDATE_FORMAT']);
  eq(nerr('notableDate: ""'), ['NOTABLEDATE_EMPTY']);
  eq(nerr('notableDate:\n  - "2026-11-19"'), ['NOTABLEDATE_FORMAT']);
});
t('notableDates の正常な配列 → 通過', () => { eq(nerr('notableDates:\n  - "2026-11-19"\n  - "2026-12-01"'), []); eq(nwarn('notableDates:\n  - "2026-11-19"\n  - "2026-12-01"'), []); });
t('notableDates の不正な要素・形式 → エラー（どの要素かを示す）', () => {
  const r = v(withNew('notableDates:\n  - "2026-11-19"\n  - "2026-02-30"'));
  eq(codes(r.errors), ['NOTABLEDATES_INVALID']); if (!/notableDates の2番目/.test(r.errors[0].msg)) throw new Error(r.errors[0].msg);
  eq(nerr('notableDates:\n  - "2026-11-19"\n  - "10月1日"'), ['NOTABLEDATES_FORMAT']);
  eq(nerr('notableDates:\n  - "2026-11-19/2026-11-20"'), ['NOTABLEDATES_RANGE_NOT_ALLOWED']);
  /* リストでないと Hugo のサイドバーでビルドが止まる */
  eq(nerr('notableDates: "2026-11-19"'), ['NOTABLEDATES_NOT_LIST']);
  eq(nerr('notableDates: []'), ['NOTABLEDATES_EMPTY']);
});
t('notableDates の未整列・重複 → 警告のみ', () => {
  eq(nwarn('notableDates:\n  - "2026-12-01"\n  - "2026-11-19"'), ['NOTABLEDATES_UNSORTED']);
  eq(nwarn('notableDates:\n  - "2026-11-19"\n  - "2026-11-19"'), ['NOTABLEDATES_DUPLICATE']);
});
t('shopDate の正常な日付・年月だけの値 → 通過', () => {
  eq(nerr('shopDate: "2026-10-20"'), []); eq(nerr('shopDate: "2026-10"'), []); eq(nerr('shopDate: 2026-10-20'), []);
  eq(nwarn('shopDate: "2026-10"'), []);
});
t('shopDate の存在しない年月・日付・不正な形式 → エラー', () => {
  eq(nerr('shopDate: "2026-13"'), ['SHOPDATE_INVALID']); eq(nerr('shopDate: "2026-00"'), ['SHOPDATE_INVALID']);
  eq(nerr('shopDate: "2026-02-30"'), ['SHOPDATE_INVALID']); eq(nerr('shopDate: "2027-02-29"'), ['SHOPDATE_INVALID']);
  eq(nerr('shopDate: "2028-02-29"'), []);
  ['2026/10/20', '2026-10-20/2026-10-31', '10月下旬', '2026-1', '2026'].forEach((x) => eq(nerr('shopDate: "' + x + '"'), ['SHOPDATE_FORMAT'], x));
  eq(nerr('shopDate: ""'), ['SHOPDATE_EMPTY']);
});
t('shopUnconfirmed の真偽値 → 通過、文字列 → エラー', () => {
  eq(nerr('shopUnconfirmed: true'), []); eq(nerr('shopUnconfirmed: false'), []);
  eq(nerr('shopUnconfirmed: "true"'), ['SHOPUNCONFIRMED_NOT_BOOLEAN']); eq(nerr('shopUnconfirmed: "false"'), ['SHOPUNCONFIRMED_NOT_BOOLEAN']);
  eq(nerr('shopUnconfirmed: yes'), ['SHOPUNCONFIRMED_NOT_BOOLEAN']); eq(nerr('shopUnconfirmed: True'), ['SHOPUNCONFIRMED_NOT_BOOLEAN']);
});
t('calendar の真偽値 → 通過、文字列 → エラー', () => {
  eq(nerr('calendar: true', GOOD), []); eq(nerr('calendar: false', GOOD), []);
  eq(nerr('calendar: "true"', GOOD), ['CALENDAR_NOT_BOOLEAN']); eq(nerr('calendar: 1', GOOD), ['CALENDAR_NOT_BOOLEAN']);
});
t('新項目をすべて追加した記事の新規投稿 → 通過（既存の eventDate との併用も可）', () => {
  const all = 'eventKind: "event"\nnotableDate: "2026-11-01"\nnotableDates:\n  - "2026-11-02"\n  - "2026-11-03"\nshopStatus: "open_planned"\nshopDate: "2026-11"\nshopUnconfirmed: true\ncalendar: false';
  eq(nerr(all), []); eq(nwarn(all), []);
  /* 現行プロンプトどおりの eventDate（開店日）＋ eventOngoing ＋ 新項目 */
  eq(codes(v(withNew('shopStatus: "open"\nshopDate: "2026-10-20"').replace('eventDate: "2026-10-20"', 'eventDate: "2026-10-20"\neventOngoing: true')).errors), []);
});
t('開店・閉店記事の eventDate に新しい警告を出さない（カテゴリとの組み合わせは問わない）', () => {
  eq(codes(v(SHOP).warnings), []); eq(nwarn('shopStatus: "open"'), []);
});
t('新項目を保持した既存記事の全文置換（本文・lastmod だけの更新）→ 通過', () => {
  const before = withNew('eventKind: "fair"\nshopStatus: "open"\nshopDate: "2026-10"\nshopUnconfirmed: false\nnotableDates:\n  - "2026-11-02"\n  - "2026-11-03"');
  const r = upd(addLastmod(before).replace('<p>本文</p>', '<p>本文</p><p>追記</p>'), before);
  eq(codes(r.errors), []); eq(codes(r.warnings), []);
});
t('既存の不正な新項目の値を変えない更新 → 警告に下げる／値を不正に変えた更新 → エラー', () => {
  const bad = withNew('shopStatus: "opened"\nshopDate: "2026-13"');
  const r = upd(addLastmod(bad), bad); eq(codes(r.errors), []); eq(codes(r.warnings), ['SHOPDATE_INVALID', 'SHOPSTATUS_INVALID']);
  const good = withNew('shopStatus: "open"\nshopDate: "2026-10"');
  eq(codes(upd(addLastmod(withNew('shopStatus: "open"\nshopDate: "2026-13"')), good).errors), ['SHOPDATE_INVALID']);
  eq(codes(upd(addLastmod(withNew('shopStatus: "open"\ncalendar: "true"')), good).errors), ['CALENDAR_NOT_BOOLEAN']);
});
t('新項目付きの意図的な予約投稿 → 従来どおり警告・確認のみ', () => {
  const r = v(replaceLine(withNew('shopStatus: "open_planned"\nshopDate: "2026-11"'), 'date:', 'date: 2026-10-05T19:00:00+09:00').replace('20261004', '20261005'), { path: 'content/posts/20261005-example-slug.md' });
  eq(codes(r.errors), []); eq(codes(r.warnings), ['DATE_FUTURE']);
});

console.log('■ date');
t('date なし → DATE_MISSING', () => { eq(codes(v(GOOD.replace(/date: .*\n/, '')).errors), ['DATE_MISSING']); });
t('形式不正 → DATE_FORMAT', () => { eq(codes(v(replaceLine(GOOD, 'date:', 'date: 2026/10/04 10:00')).errors), ['DATE_FORMAT']); });
t('存在しない日付・時刻 → DATE_INVALID', () => {
  eq(codes(v(replaceLine(GOOD, 'date:', 'date: 2026-02-30T10:00:00+09:00')).errors), ['DATE_INVALID']);
  eq(codes(v(replaceLine(GOOD, 'date:', 'date: 2026-10-04T25:00:00+09:00')).errors), ['DATE_INVALID']);
});
t('クォート付き date も可', () => { eq(codes(v(replaceLine(GOOD, 'date:', 'date: "2026-10-04T10:00:00+09:00"')).errors), []); });
t('近い未来は予約投稿の警告のみ（ブロックしない）', () => {
  const r = v(replaceLine(GOOD, 'date:', 'date: 2026-10-05T19:00:00+09:00').replace('20261004', '20261005'), { path: 'content/posts/20261005-example-slug.md' });
  eq(codes(r.errors), []); eq(codes(r.warnings), ['DATE_FUTURE']);
  if (!/2026-10-05 19:00/.test(r.warnings[0].msg)) throw new Error('日本時間の表示が無い: ' + r.warnings[0].msg);
});
t('30日より先は誤入力の可能性として警告（ブロックしない）', () => {
  const r = v(replaceLine(GOOD, 'date:', 'date: 2027-10-04T10:00:00+09:00'));
  eq(codes(r.errors), []); if (!codes(r.warnings).includes('DATE_FAR_FUTURE')) throw new Error(JSON.stringify(r.warnings));
});
t('タイムゾーンなしは UTC 扱いを警告', () => {
  const r = v(replaceLine(GOOD, 'date:', 'date: 2026-10-04T01:00:00'));
  eq(codes(r.errors), []); eq(codes(r.warnings), ['DATE_NO_TZ']);
  if (!/2026-10-04 10:00/.test(r.warnings[0].msg)) throw new Error(r.warnings[0].msg);
});
t('ファイル名の日付と date（日本時間）の不一致を警告', () => {
  eq(codes(v(GOOD, { path: 'content/posts/20261003-example-slug.md' }).warnings), ['DATE_FILENAME_MISMATCH']);
  /* UTC 表記でも日本時間の日付で比較する */
  eq(codes(v(replaceLine(GOOD, 'date:', 'date: 2026-10-03T16:00:00Z')).warnings), []);
});

console.log('■ URL 衝突');
t('同じ URL を別ファイルが使う → 衝突', () => {
  const idx = R.buildUrlIndex([{ path: 'content/posts/a.md', url: '/posts/x/' }]);
  eq(R.findConflicts(idx, { path: 'content/posts/b.md', url: 'https://urayasu-portal.com/posts/x/' }).length, 1);
});
t('同じファイル自身（更新）は衝突にしない', () => {
  const idx = R.buildUrlIndex([{ path: 'content/posts/a.md', url: '/posts/x/' }]);
  eq(R.findConflicts(idx, { path: 'content/posts/a.md', url: '/posts/x/' }).length, 0);
});
t('aliases との衝突も検出', () => {
  const idx = R.buildUrlIndex([{ path: 'content/posts/a.md', url: '/posts/a/', aliases: ['/posts/x/'] }]);
  eq(R.findConflicts(idx, { path: 'content/posts/b.md', url: '/posts/x' })[0].otherVia, 'alias');
});
t('日本語 URL（エンコード済み・未エンコード）を同一視', () => {
  const idx = R.buildUrlIndex([{ path: 'a.md', url: '/posts/浦安/' }]);
  eq(R.findConflicts(idx, { path: 'b.md', url: '/posts/%E6%B5%A6%E5%AE%89/' }).length, 1);
});
t('多言語版は URL が別なので衝突しない', () => {
  eq(R.expectedUrl('content/posts/20261004-x.en.md', { slug: 'x' }), '/en/posts/x/');
  eq(R.expectedUrl('content/posts/20261004-x.md', { slug: 'x' }), '/posts/x/');
  eq(R.aliasesOf({ aliases: ['/travel-guide/pool/'] }, 'en'), ['/en/travel-guide/pool/']);
});

/* ── 既存記事の回帰テスト（--unit-only では省略。CI は既存不備の扱いを validate-content.mjs に任せる） ── */
if (!process.argv.includes('--unit-only')) {
console.log('■ 既存記事の回帰（content/posts 全件）');
const dir = path.join(ROOT, 'content/posts');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_index'));
const oldToolBlocks = (text) => {
  /* 改修前の投稿ツールのブロック条件（post-tool.html checkArticleQuality の errors 部分を移植） */
  const ALLOWED = ['開店・閉店', 'ニュース', 'イベント', 'グルメ・カフェ', 'スポーツ', '子育て・教育', 'お知らせ'];
  const m = text.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/);
  if (!m) return ['FM'];
  const fm = m[1]; const errs = [];
  const cm = fm.match(/^categories:\n((?:[ \t]*-[ \t]*.+\n?)*)/m);
  if (cm) Array.from(cm[1].matchAll(/-\s*["']?([^"'\n]+?)["']?\s*$/gm)).map((x) => x[1].trim()).forEach((c) => { if (!ALLOWED.includes(c)) errs.push('CAT'); });
  if (/^eventDates?:/m.test(fm) && !/^hideEventBox:\s*true/m.test(fm)) errs.push('EVENT');
  if (!/^draft:\s*false/m.test(fm)) errs.push('DRAFT');
  return errs;
};
let newlyBlocked = [];
let legacyOk = 0;
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  /* 改修前ツールは BOM/CRLF 入りの文字列を FM 形式エラーにしていた。比較は正規化後の本文で行う */
  const before = oldToolBlocks(R.normalizeText(text));
  const after = R.validatePost(text, { path: 'content/posts/' + f, isNew: false, now: NOW, skipBodyChecks: true }).errors;
  if (before.length === 0 && after.length > 0) newlyBlocked.push(f + ' → ' + [...new Set(codes(after))].join(','));
  if (before.length === 0 && after.length === 0) legacyOk++;
}
t('改修前に通っていた既存記事の「更新」が、新ルールで新たにブロックされない（frontmatter が壊れている記事を除く）', () => {
  const unexpected = newlyBlocked.filter((x) => !/→ (FM_SYNTAX,)*FM_SYNTAX$/.test(x));
  if (unexpected.length) throw new Error(unexpected.length + ' 件: ' + unexpected.slice(0, 5).join(' / '));
});
console.log('       （参考）改修前後とも通る既存記事: ' + legacyOk + ' 本 / 新ルールで新たに止まる既存記事: ' + newlyBlocked.length + ' 本 ' + (newlyBlocked.length ? '= ' + newlyBlocked.join(' / ') : ''));

/* 開催日（工程1a PR 1a-1）: 既存記事の実データで、新しいエラー規則に当たるものが無いこと */
const EV_CODE = /^(EVENTDATE|EVENTDATES|EVENT_BOTH|EVENTONGOING)/;
const evStrict = [], evUpdate = [], evWarn = {};
let evPosts = 0;
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const p = 'content/posts/' + f;
  if (!/^eventDates?:/m.test(R.normalizeText(text))) continue;
  evPosts++;
  /* 新規と同じ基準（CI と同じ）で検証 */
  const s = R.validatePost(text, { path: p, isNew: true, now: NOW, skipBodyChecks: true, skipLastmodChecks: true });
  s.errors.filter((e) => EV_CODE.test(e.code)).forEach((e) => evStrict.push(f + ' → ' + e.code));
  s.warnings.concat(s.info).filter((e) => EV_CODE.test(e.code)).forEach((e) => { evWarn[e.code] = (evWarn[e.code] || 0) + 1; });
  /* 本文・lastmod だけを変えた更新（全文置換の続報）として検証 */
  const u = R.validatePost(text.replace(/\n---/, '\nlastmod: 2026-10-05T10:00:00+09:00\n---'), { path: p, isNew: false, now: NOW, skipBodyChecks: true, prevText: text });
  u.errors.filter((e) => EV_CODE.test(e.code)).forEach((e) => evUpdate.push(f + ' → ' + e.code));
}
t('既存記事の eventDate・eventDates に、新規投稿でもエラーになる値が無い（CI で新しい不備にならない）', () => {
  if (evStrict.length) throw new Error(evStrict.length + ' 件: ' + evStrict.slice(0, 5).join(' / '));
});
t('既存記事の本文・lastmod だけの更新が、開催日の検証で止まらない', () => {
  if (evUpdate.length) throw new Error(evUpdate.length + ' 件: ' + evUpdate.slice(0, 5).join(' / '));
});
console.log('       （参考）開催日を持つ既存記事: ' + evPosts + ' 本 / 警告・情報の内訳: ' + (Object.entries(evWarn).map(([k, n]) => k + ' ' + n).join('、') || 'なし'));

/* 新項目（工程1a PR 1a-2）: 既存記事の実データで、新しい規則に当たるものが無いこと（新項目を持つ記事は既存の notableDate 1本だけ） */
const NF_CODE = /^(EVENTKIND|NOTABLEDATE|NOTABLEDATES|SHOPSTATUS|SHOPDATE|SHOPUNCONFIRMED|CALENDAR)_/;
const nfFound = [], nfUsing = {};
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const d = R.parseFrontmatter(text).data;
  R.NEW_FIELDS.forEach((k) => { if (d[k] !== undefined) nfUsing[k] = (nfUsing[k] || 0) + 1; });
  const s = R.validatePost(text, { path: 'content/posts/' + f, isNew: true, now: NOW, skipBodyChecks: true, skipLastmodChecks: true });
  s.errors.concat(s.warnings).filter((e) => NF_CODE.test(e.code)).forEach((e) => nfFound.push(f + ' → ' + e.code));
}
t('既存記事に、新項目の規則でエラー・警告になる値が無い', () => { if (nfFound.length) throw new Error(nfFound.length + ' 件: ' + nfFound.slice(0, 5).join(' / ')); });
console.log('       （参考）新項目を持つ既存記事: ' + (Object.entries(nfUsing).map(([k, n]) => k + ' ' + n).join('、') || 'なし'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
