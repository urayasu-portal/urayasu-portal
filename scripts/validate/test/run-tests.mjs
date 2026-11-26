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
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
/* CI だけの追加検査（P0-B）。validate-content.mjs が post-rules.js の結果に加えて使う */
import * as PC from '../post-checks.mjs';

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
t('shopStatus の正常値10種類 → 通過', () => {
  eq(R.SHOP_STATUSES, ['open', 'open_planned', 'close', 'close_planned', 'temp_close', 'reopen', 'renewal', 'move', 'feature', 'popup']);
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
  eq(nwarn('shopStatus: "open_planned"\nshopDate: "2026-10"'), []); /* shopStatus なしの shopDate は工程1a PR 5 から警告 */
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

console.log('■ 会場・主催者（eventLocation・organizer、工程1a PR 4）');
const terr = (lines) => codes(v(withNew(lines, GOOD)).errors);
const twarn = (lines) => codes(v(withNew(lines, GOOD)).warnings);
t('無い → エラー・警告なし（任意項目）', () => { eq(codes(v(GOOD).errors), []); eq(codes(v(GOOD).warnings), []); });
t('正常な会場名・主催者名 → 通過', () => {
  eq(terr('eventLocation: "浦安市総合公園・高洲海浜公園"\norganizer: "浦安市・浦安市ふるさとづくり推進協議会"'), []);
  eq(twarn('eventLocation: "浦安市総合公園・高洲海浜公園"\norganizer: "浦安市・浦安市ふるさとづくり推進協議会"'), []);
  eq(terr('eventLocation: 浦安市文化会館'), []); /* 引用符なしの文字列も可 */
});
t('空・空白だけ → *_EMPTY', () => {
  eq(terr('eventLocation: ""'), ['EVENTLOCATION_EMPTY']);
  eq(terr('organizer: "   "'), ['ORGANIZER_EMPTY']);
  eq(terr('eventLocation:'), ['EVENTLOCATION_EMPTY']);
  eq(terr('organizer: "　"'), ['ORGANIZER_EMPTY']);
});
t('文字列でない（リスト・真偽値・数値・null）→ *_NOT_STRING', () => {
  eq(terr('eventLocation:\n  - "文化会館"\n  - "中央公民館"'), ['EVENTLOCATION_NOT_STRING']);
  eq(terr('eventLocation: ["文化会館"]'), ['EVENTLOCATION_NOT_STRING']);
  eq(terr('organizer: true'), ['ORGANIZER_NOT_STRING']);
  eq(terr('organizer: 123'), ['ORGANIZER_NOT_STRING']);
  eq(terr('eventLocation: null'), ['EVENTLOCATION_NOT_STRING']);
  eq(terr('organizer: "123"'), []); /* 引用符付きなら文字列 */
});
t('確定していない値 → *_UNCONFIRMED（警告）', () => {
  eq(twarn('eventLocation: "未定"'), ['EVENTLOCATION_UNCONFIRMED']);
  eq(twarn('eventLocation: "会場は未発表"'), ['EVENTLOCATION_UNCONFIRMED']);
  eq(twarn('organizer: "不明"'), ['ORGANIZER_UNCONFIRMED']);
  eq(twarn('organizer: "TBD"'), ['ORGANIZER_UNCONFIRMED']);
  eq(terr('eventLocation: "未定"'), []); /* エラーにはしない */
});
t('80文字を超える値 → *_LONG（警告）', () => {
  eq(twarn('eventLocation: "' + 'あ'.repeat(81) + '"'), ['EVENTLOCATION_LONG']);
  eq(twarn('organizer: "' + 'あ'.repeat(80) + '"'), []);
});
t('既存の不正な値を変えない更新 → 警告に下げる／値を不正に変えた更新 → エラー', () => {
  const bad = withNew('eventLocation: ""', GOOD);
  const r = upd(addLastmod(bad), bad);
  eq(codes(r.errors), []); eq(codes(r.warnings).includes('EVENTLOCATION_EMPTY'), true);
  const good = withNew('eventLocation: "文化会館"', GOOD);
  eq(codes(upd(addLastmod(withNew('eventLocation: true', GOOD)), good).errors), ['EVENTLOCATION_NOT_STRING']);
});

console.log('■ 店舗の状態（shopStatus・shopDate・shopUnconfirmed の整合、工程1a PR 5）');
const swarn = (lines, extra) => codes(v(withNew(lines), extra).warnings).filter((c) => /^SHOP/.test(c));
const at = (iso) => ({ now: Date.parse(iso) });
t('popup は正式な値（10種類目）', () => { eq(R.SHOP_STATUSES.includes('popup'), true); eq(nerr('shopStatus: "popup"'), []); eq(swarn('shopStatus: "popup"'), []); });
t('開店・閉店の新規記事で shopStatus が無い → SHOPSTATUS_MISSING（SHOP_STATUS_FROM 以降の date だけ）', () => {
  const late = replaceLine(SHOP, 'date:', 'date: 2026-10-07T10:00:00+09:00');
  const ctx = { path: 'content/posts/20261007-example-slug.md', now: Date.parse('2026-10-08T12:00:00+09:00') };
  eq(codes(v(late, ctx).warnings).includes('SHOPSTATUS_MISSING'), true);
  eq(codes(v(late.replace('hideEventBox: true', 'shopStatus: "open"\nhideEventBox: true'), ctx).warnings).includes('SHOPSTATUS_MISSING'), false);
  eq(codes(v(SHOP).warnings).includes('SHOPSTATUS_MISSING'), false); /* SHOP_STATUS_FROM より前の date（既存記事）は警告しない */
  eq(codes(v(replaceLine(GOOD, 'date:', 'date: 2026-10-07T10:00:00+09:00'), ctx).warnings).includes('SHOPSTATUS_MISSING'), false); /* 開店・閉店以外 */
  eq(codes(R.validatePost(late, Object.assign({ isNew: false, skipBodyChecks: true, prevText: late }, ctx)).warnings).includes('SHOPSTATUS_MISSING'), false); /* 更新は対象外 */
});
t('shopDate・shopUnconfirmed だけで shopStatus が無い → SHOP_FIELDS_WITHOUT_STATUS', () => {
  eq(swarn('shopDate: "2026-10"'), ['SHOP_FIELDS_WITHOUT_STATUS']);
  eq(swarn('shopUnconfirmed: true'), ['SHOP_FIELDS_WITHOUT_STATUS']);
});
t('open・close なのに shopDate が未来 → SHOP_CONFIRMED_FUTURE（年月は翌月以降が未来）', () => {
  eq(swarn('shopStatus: "open"\nshopDate: "2026-10-20"'), ['SHOP_CONFIRMED_FUTURE']); /* 判定は 2026-10-04 */
  eq(swarn('shopStatus: "close"\nshopDate: "2026-11"'), ['SHOP_CONFIRMED_FUTURE']);
  eq(swarn('shopStatus: "open"\nshopDate: "2026-10"'), []);
  eq(swarn('shopStatus: "open"\nshopDate: "2026-10-04"'), []);
  eq(swarn('shopStatus: "open_planned"\nshopDate: "2026-10-20"'), []);
  eq(swarn('shopStatus: "renewal"\nshopDate: "2026-10-20"'), []);
});
t('予定日経過 → SHOP_PLANNED_PASSED（日付は翌日から、年月はその月が終わってから）', () => {
  eq(swarn('shopStatus: "open_planned"\nshopDate: "2026-10-03"'), ['SHOP_PLANNED_PASSED']);
  eq(swarn('shopStatus: "open_planned"\nshopDate: "2026-10-04"'), []); /* 当日はまだ */
  eq(swarn('shopStatus: "close_planned"\nshopDate: "2026-09"'), ['SHOP_PLANNED_PASSED']);
  eq(swarn('shopStatus: "close_planned"\nshopDate: "2026-10"'), []); /* 月の途中は経過扱いにしない */
  eq(swarn('shopStatus: "open_planned"\nshopUnconfirmed: true\nshopDate: "2026-09"'), ['SHOP_PLANNED_PASSED']);
  eq(swarn('shopStatus: "open_planned"'), []); /* 日付なし */
});
t('予定日経過の日本時間の境目（UTC と日付が違う時間帯を含む）', () => {
  const day = 'shopStatus: "open_planned"\nshopDate: "2026-10-31"', mon = 'shopStatus: "open_planned"\nshopDate: "2026-10"';
  eq(swarn(day, at('2026-10-31T14:59:59Z')), []); /* JST 10/31 23:59:59 */
  eq(swarn(mon, at('2026-10-31T14:59:59Z')), []);
  eq(swarn(day, at('2026-10-31T15:00:01Z')), ['SHOP_PLANNED_PASSED']); /* JST 11/1 00:00:01（UTC は 10/31） */
  eq(swarn(mon, at('2026-10-31T15:00:01Z')), ['SHOP_PLANNED_PASSED']);
  eq(swarn('shopStatus: "open_planned"\nshopDate: "2026-10-04"', at('2026-10-04T15:30:00Z')), ['SHOP_PLANNED_PASSED']); /* UTC 10/4・JST 10/5 */
});
t('まとめに shopUnconfirmed: true → SHOP_UNCONFIRMED_FEATURE', () => {
  eq(swarn('shopStatus: "feature"\nshopUnconfirmed: true'), ['SHOP_UNCONFIRMED_FEATURE']);
  eq(swarn('shopStatus: "open_planned"\nshopUnconfirmed: true\nshopDate: "2026-11"'), []);
});
t('不正な shopDate・shopUnconfirmed・shopStatus はエラー（警告は重ねない）', () => {
  eq(nerr('shopStatus: "open_planned"\nshopDate: "2026-10-32"'), ['SHOPDATE_INVALID']);
  eq(nerr('shopStatus: "open_planned"\nshopDate: "10月下旬"'), ['SHOPDATE_FORMAT']);
  eq(nerr('shopStatus: "open_planned"\nshopUnconfirmed: "true"'), ['SHOPUNCONFIRMED_NOT_BOOLEAN']);
  eq(nerr('shopStatus: "pop-up"'), ['SHOPSTATUS_INVALID']); eq(swarn('shopStatus: "pop-up"'), []);
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

/* ── CI だけの追加検査（scripts/validate/post-checks.mjs、P0-B 2026-11-01） ── */
console.log('■ 追加検査（P0-B）: 先頭の空白・新規記事の判定');
const NOW_B = Date.parse('2026-11-01T20:30:00+09:00');
const NB = (date, extra) => [
  '---',
  'title: "【浦安市】新規テスト記事、11月10日に開催"',
  'date: ' + date,
  'slug: "new-test"',
  'categories:',
  '  - "イベント"',
  'tags:',
  '  - "浦安市"',
  'description: "説明文です。"',
  'eventDate: "2026-11-10"',
  'eventKind: "event"',
  'hideEventBox: true',
  'sources:',
  '  - name: "浦安市公式"',
  '    url: "https://www.city.urayasu.lg.jp/"',
  'draft: false',
  '---',
  '<p>本文 <a href="/posts/old/">前回の記事</a></p>',
  ''
].join('\n').replace('draft: false', (extra || '') + 'draft: false');
const NEW_OK = NB('2026-11-01T18:00:00+09:00');
const LEGACY = NB('2026-10-31T18:00:00+09:00');
const SITE = new Set(['/posts/old/', '/travel-guide/', '/en/posts/old/']);
const pc = (text, o = {}) => {
  const p = o.path || 'content/posts/20261101-new-test.md';
  const fm = R.parseFrontmatter(text);
  const dp = R.parseDate(fm.data.date);
  return PC.checkPost({
    path: p, lang: R.langOfPath(p), fm, dp, strict: PC.isStrict(dp), now: o.now == null ? NOW_B : o.now,
    siteUrls: o.siteUrls === undefined ? SITE : o.siteUrls, staticExists: (s) => s === '/images/ok.png',
    eventName: o.eventName || '', bodyLineOffset: fm.fmText.split('\n').length + 2
  });
};
const rl = (list, sev) => list.filter((x) => !sev || x.severity === sev).map((x) => x.rule).sort();
const msgOf = (list, rule) => (list.find((x) => x.rule === rule) || { msg: '' }).msg;
const withBody = (text, body) => text.replace(/---\n<p>[\s\S]*$/, '---\n' + body + '\n');

t('正常な新規記事は追加検査でエラー・警告なし', () => { eq(rl(pc(NEW_OK)), []); });
t('空行のあとに --- → 「1行目より前に空白があります」（--- の行番号つき）', () => {
  const r = PC.leadingWhitespace('\n\n' + NEW_OK);
  eq(r.found, true); eq(r.line, 3);
  if (!/^1行目より前に空白があります（frontmatter の --- が 3 行目にあります）/.test(r.msg)) throw new Error(r.msg);
  eq(r.stripped, NEW_OK);
});
t('--- の前の空白（字下げ）・空白だけの行・CRLF も検出、BOM だけは対象外', () => {
  eq(PC.leadingWhitespace('  ' + NEW_OK).line, 1);
  eq(PC.leadingWhitespace(' \t\n' + NEW_OK).line, 2);
  eq(PC.leadingWhitespace('\r\n' + NEW_OK.replace(/\n/g, '\r\n')).found, true);
  eq(PC.leadingWhitespace('﻿' + NEW_OK).found, false);
  eq(PC.leadingWhitespace(NEW_OK).found, false);
});
t('--- が無い・前置きの文章がある場合は対象外（post-rules.js の FM_NO_START に任せる）', () => {
  eq(PC.leadingWhitespace('\n■ 内容\n' + NEW_OK).found, false);
  eq(PC.leadingWhitespace('\ntitle: x\n').found, false);
});
t('新規記事の判定は date の日本時間の日付（2026-11-01 以降）。読めない date は新規扱い', () => {
  eq(PC.isStrict(R.parseDate('2026-10-31T23:59:00+09:00')), false);
  eq(PC.isStrict(R.parseDate('2026-11-01T00:00:00+09:00')), true);
  eq(PC.isStrict(R.parseDate('2026-10-31T15:00:00Z')), true);
  eq(PC.isStrict(R.parseDate('2026-10-31T14:59:00Z')), false);
  eq(PC.isStrict(R.parseDate('令和8年11月1日')), true);
  eq(PC.isStrict(R.parseDate('2026-09-15T10:00:00+09:00'), '2026-09-01'), true);
});

console.log('■ 追加検査（P0-B）: 公開されない date（buildFuture なし）');
const TODAY_LATE = replaceLine(NEW_OK, 'date:', 'date: 2026-11-01T22:00:00+09:00');
t('当日の未来時刻（旧 22:00 ルール）→ DATE_NOT_PUBLISHED エラー', () => {
  const r = pc(TODAY_LATE);
  eq(rl(r, 'error'), ['DATE_NOT_PUBLISHED']);
  if (!/^date が公開時刻より未来です（buildFuture なしのため公開されません）。date は日本時間 2026-11-01 22:00、検証時刻は 2026-11-01 20:30/.test(msgOf(r, 'DATE_NOT_PUBLISHED'))) throw new Error(msgOf(r, 'DATE_NOT_PUBLISHED'));
});
t('push 以外（schedule・pull_request・workflow_dispatch）は警告に下げる', () => {
  ['schedule', 'pull_request', 'workflow_dispatch'].forEach((e) => eq(rl(pc(TODAY_LATE, { eventName: e }), 'warning'), ['DATE_NOT_PUBLISHED'], e));
  eq(rl(pc(TODAY_LATE, { eventName: 'push' }), 'error'), ['DATE_NOT_PUBLISHED']);
});
t('翌日以降の日付は予約投稿として対象外（従来どおり post-rules.js の DATE_FUTURE 通知）・過去は対象外', () => {
  eq(rl(pc(replaceLine(NEW_OK, 'date:', 'date: 2026-11-02T07:00:00+09:00'))), []);
  eq(rl(pc(replaceLine(NEW_OK, 'date:', 'date: 2026-11-01T20:29:00+09:00'))), []);
});
t('UTC 表記・タイムゾーン無しでも Hugo と同じ解釈で判定する', () => {
  eq(rl(pc(replaceLine(NEW_OK, 'date:', 'date: 2026-11-01T12:00:00Z'))), ['DATE_NOT_PUBLISHED']);
  /* タイムゾーン無しは UTC 扱い（日本時間 2026-11-02 02:00 = 翌日なので予約投稿扱い） */
  eq(rl(pc(replaceLine(NEW_OK, 'date:', 'date: 2026-11-01T17:00:00'))), []);
});
t('publishDate があればそちらで判定し、既存記事にも適用する', () => {
  const r = pc(NB('2026-10-31T18:00:00+09:00', 'publishDate: 2026-11-01T23:00:00+09:00\n'));
  eq(rl(r, 'error'), ['DATE_NOT_PUBLISHED']);
  if (!/^publishDate が公開時刻より未来です/.test(r[0].msg)) throw new Error(r[0].msg);
  eq(rl(pc(NB('2026-11-01T18:00:00+09:00', 'publishDate: "あした"\n')), 'error'), ['PUBLISHDATE_FORMAT']);
});
t('expiryDate を過ぎた記事（buildExpired なし）→ 新規はエラー・既存は警告、形式不正はエラー', () => {
  eq(rl(pc(NB('2026-11-01T18:00:00+09:00', 'expiryDate: 2026-11-01T19:00:00+09:00\n')), 'error'), ['EXPIRYDATE_PASSED']);
  eq(rl(pc(NB('2026-10-31T18:00:00+09:00', 'expiryDate: 2026-11-01T19:00:00+09:00\n')), 'warning'), ['EXPIRYDATE_PASSED']);
  eq(rl(pc(NB('2026-11-01T18:00:00+09:00', 'expiryDate: 2026-12-01T00:00:00+09:00\n'))), []);
  eq(rl(pc(NB('2026-11-01T18:00:00+09:00', 'expiryDate: "12月"\n'))), ['EXPIRYDATE_FORMAT']);
});

console.log('■ 追加検査（P0-B）: 必須項目・lastmod（新規記事だけ）');
t('description なし → DESCRIPTION_MISSING（新規）／既存記事は対象外', () => {
  eq(rl(pc(NEW_OK.replace('description: "説明文です。"\n', ''))), ['DESCRIPTION_MISSING']);
  eq(rl(pc(NEW_OK.replace('description: "説明文です。"', 'description: ""'))), ['DESCRIPTION_MISSING']);
  eq(rl(pc(LEGACY.replace('description: "説明文です。"\n', ''), { path: 'content/posts/20261031-new-test.md' })), []);
});
t('tags なし → TAGS_MISSING（ja の新規だけ。翻訳版・既存記事は対象外）、文字列は TAGS_FORMAT', () => {
  const noTags = NEW_OK.replace('tags:\n  - "浦安市"\n', '');
  eq(rl(pc(noTags)), ['TAGS_MISSING']);
  eq(rl(pc(NEW_OK.replace('tags:\n  - "浦安市"\n', 'tags: []\n'))), ['TAGS_MISSING']);
  eq(rl(pc(NEW_OK.replace('tags:\n  - "浦安市"\n', 'tags: "浦安市"\n'))), ['TAGS_FORMAT']);
  eq(rl(pc(noTags, { path: 'content/posts/20261101-new-test.en.md' })), []);
  eq(rl(pc(LEGACY.replace('tags:\n  - "浦安市"\n', ''))), []);
  if (!/data\/guide_map\.yaml/.test(msgOf(pc(noTags), 'TAGS_MISSING'))) throw new Error('guide_map の案内が無い');
});
t('lastmod: 形式不正・date より前の日はエラー、今日より先は警告、同じ日の日付だけは可', () => {
  eq(rl(pc(NB('2026-11-01T18:00:00+09:00', 'lastmod: "11月1日"\n'))), ['LASTMOD_FORMAT']);
  eq(rl(pc(NB('2026-11-01T18:00:00+09:00', 'lastmod: 2026-10-31\n'))), ['LASTMOD_BEFORE_DATE']);
  eq(rl(pc(NB('2026-11-01T18:00:00+09:00', 'lastmod: 2026-11-03\n'))), ['LASTMOD_FUTURE']);
  eq(rl(pc(NB('2026-11-01T18:00:00+09:00', 'lastmod: 2026-11-01\n'))), []);
  eq(rl(pc(NB('2026-10-31T18:00:00+09:00', 'lastmod: 2026-10-30\n'))), []);
});

console.log('■ 追加検査（P0-B）: 開催日と記事の date の食い違い（警告）');
t('eventKind だけで開催日なし → EVENTKIND_WITHOUT_DATE（警告）', () => {
  eq(rl(pc(NEW_OK.replace('eventDate: "2026-11-10"\n', '')), 'warning'), ['EVENTKIND_WITHOUT_DATE']);
});
t('開催日の最終日が date より30日以上前 → EVENT_ENDED_BEFORE_POST（警告。eventOngoing は対象外）', () => {
  eq(rl(pc(NEW_OK.replace('"2026-11-10"', '"2025-11-10"'))), ['EVENT_ENDED_BEFORE_POST']);
  eq(rl(pc(NEW_OK.replace('"2026-11-10"', '"2026-09-01/2026-10-15"'))), []);
  eq(rl(pc(NEW_OK.replace('"2026-11-10"', '"2026-09-01"').replace('hideEventBox: true', 'eventOngoing: true\nhideEventBox: true'))), []);
  if (!/2025-11-10.*2026-11-01.*年・月の誤入力/.test(msgOf(pc(NEW_OK.replace('"2026-11-10"', '"2025-11-10"')), 'EVENT_ENDED_BEFORE_POST'))) throw new Error('文言');
});
t('開催日が date より1年以上先 → EVENT_FAR_AFTER_POST（警告）、eventDates も見る', () => {
  eq(rl(pc(NEW_OK.replace('"2026-11-10"', '"2027-11-10"'))), ['EVENT_FAR_AFTER_POST']);
  eq(rl(pc(NEW_OK.replace('eventDate: "2026-11-10"', 'eventDates:\n  - "2027-12-01"\n  - "2027-12-08"'))), ['EVENT_FAR_AFTER_POST']);
  eq(rl(pc(NEW_OK.replace('"2026-11-10"', '"2027-03-01"'))), []);
});
t('既存記事（2026-11-01 より前）には開催日の食い違いを出さない', () => {
  eq(rl(pc(LEGACY.replace('"2026-11-10"', '"2025-11-10"'))), []);
});

console.log('■ 追加検査（P0-B）: 出典と広告リンク・本文のリンク');
const srcLine = (u) => NEW_OK.replace('"https://www.city.urayasu.lg.jp/"', '"' + u + '"');
t('出典に広告（アフィリエイト）リンク → SOURCES_AFFILIATE', () => {
  eq(rl(pc(srcLine('https://px.a8.net/svt/ejp?a8mat=XXXX'))), ['SOURCES_AFFILIATE']);
  eq(rl(pc(srcLine('https://hb.afl.rakuten.co.jp/hgc/xxx/'))), ['SOURCES_AFFILIATE']);
  eq(rl(pc(srcLine('https://www.trip.com/things-to-do/detail/1/?Allianceid=8989807&SID=1'))), ['SOURCES_AFFILIATE']);
  if (!/Allianceid/.test(msgOf(pc(srcLine('https://www.trip.com/x/?Allianceid=1')), 'SOURCES_AFFILIATE'))) throw new Error('理由が無い');
});
t('提携パラメータの無い同じサイトの URL・一般の URL は出典として可', () => {
  eq(rl(pc(srcLine('https://www.trip.com/events/2634402-2025-urayasu-collection/'))), []);
  eq(rl(pc(srcLine('https://www.city.urayasu.lg.jp/a/b.html?cid=1'))), []);
});
t('出典の URL が http(s) でない → SOURCES_URL_INVALID、文字列だけのリスト → SOURCES_FORMAT、name だけは可', () => {
  eq(rl(pc(srcLine('www.city.urayasu.lg.jp/'))), ['SOURCES_URL_INVALID']);
  eq(rl(pc(NEW_OK.replace('  - name: "浦安市公式"\n    url: "https://www.city.urayasu.lg.jp/"', '  - "https://www.city.urayasu.lg.jp/"'))), ['SOURCES_FORMAT']);
  eq(rl(pc(NEW_OK.replace('\n    url: "https://www.city.urayasu.lg.jp/"', ''))), []);
  eq(rl(pc(NEW_OK.replace('  - name: "浦安市公式"\n    url: "https://www.city.urayasu.lg.jp/"', '  - name: ""'))), ['SOURCES_FORMAT']);
});
t('既存記事の出典は対象外', () => { eq(rl(pc(LEGACY.replace('"https://www.city.urayasu.lg.jp/"', '"https://px.a8.net/x"'))), []); });
t('本文の空リンク・仮の URL → LINK_EMPTY・LINK_PLACEHOLDER（行番号つき）', () => {
  const r = pc(withBody(NEW_OK, '<p><a href="">a</a></p>\n<p><a href="http://localhost:1313/posts/x/">b</a> [c]()</p>'));
  eq(rl(r), ['LINK_EMPTY', 'LINK_EMPTY', 'LINK_PLACEHOLDER']);
  if (!/^18 行目のリンク/.test(msgOf(r, 'LINK_EMPTY'))) throw new Error(msgOf(r, 'LINK_EMPTY'));
  eq(rl(pc(withBody(NEW_OK, '<a href="https://example.com/">x</a>'))), ['LINK_PLACEHOLDER']);
});
t('内部リンク切れ → LINK_INTERNAL_BROKEN（新規はエラー・既存は警告）。サイトの絶対 URL・Markdown も見る', () => {
  eq(rl(pc(withBody(NEW_OK, '<a href="/posts/nope/">x</a>')), 'error'), ['LINK_INTERNAL_BROKEN']);
  eq(rl(pc(withBody(NEW_OK, '[x](https://urayasu-portal.com/posts/nope/)')), 'error'), ['LINK_INTERNAL_BROKEN']);
  eq(rl(pc(withBody(LEGACY, '<a href="/posts/nope/">x</a>')), 'warning'), ['LINK_INTERNAL_BROKEN']);
  eq(rl(pc(withBody(NEW_OK, '<a href="/posts/old/#map">x</a> <a href="/travel-guide">y</a> <a href="https://urayasu-portal.com/en/posts/old/">z</a>'))), []);
});
t('タクソノミー・ショートコード・外部・相対・mailto は内部リンク検査の対象外、URL 一覧が無ければ検査しない', () => {
  eq(rl(pc(withBody(NEW_OK, '<a href="/tags/浦安市/">a</a> <a href="{{< relref "x.md" >}}">b</a> <a href="https://www.city.urayasu.lg.jp/">c</a> <a href="mailto:a@b.jp">d</a> <a href="x/">e</a>'))), []);
  eq(rl(pc(withBody(NEW_OK, '<a href="/posts/nope/">x</a>'), { siteUrls: null })), []);
});
t('static のファイル（画像・PDF）が無い → LINK_INTERNAL_BROKEN、生成物（.xml）は対象外', () => {
  eq(rl(pc(withBody(NEW_OK, '<img src="/images/missing.png" alt="a">'))), ['LINK_INTERNAL_BROKEN']);
  eq(rl(pc(withBody(NEW_OK, '<img src="/images/ok.png" alt="a"> <a href="/index.xml">rss</a>'))), []);
});
t('本文の広告リンク → AFFILIATE_LINK_IN_POST（警告・1記事1件）', () => {
  const r = pc(withBody(NEW_OK, '<a href="https://px.a8.net/a">x</a><a href="https://px.a8.net/b">y</a>'));
  eq(rl(r, 'warning'), ['AFFILIATE_LINK_IN_POST']); eq(rl(r, 'error'), []);
});

console.log('■ 追加検査（P0-B）: 重複・類似の記事');
const prof = (p, title, body, date, lang) => PC.dupProfile({ path: p, lang: lang || 'ja', title, body, epoch: Date.parse(date), strict: PC.isStrict(R.parseDate(date)) });
const LONG = '浦安市の若潮公園で子育て応援メッセが開催されます。'.repeat(3) + '体験ブースや警察・消防の企画、チーバくんとの交流などを予定しています。参加は無料で申し込みは不要です。雨天の場合は中止となります。会場は体験学習施設を含む若潮公園一帯で、当日は駐車場が混雑するため公共交通機関の利用を呼びかけています。'.repeat(2);
t('同じタイトルの新規記事 → DUPLICATE_TITLE（新規側だけ・エラー）', () => {
  const r = PC.findDuplicates([prof('content/posts/old.md', '【浦安市】A祭り開催', '<p>旧</p>', '2026-10-01T10:00:00+09:00'), prof('content/posts/new.md', '【浦安市】A祭り開催', '<p>新</p>', '2026-11-01T10:00:00+09:00')]);
  eq(r.map((x) => x.path + ':' + x.rule + ':' + x.severity), ['content/posts/new.md:DUPLICATE_TITLE:error']);
  if (!/既存記事（content\/posts\/old\.md）と同じです/.test(r[0].msg)) throw new Error(r[0].msg);
});
t('本文がほぼ同じ → DUPLICATE_BODY（エラー）、タイトルが似ている → SIMILAR_POST（警告）', () => {
  eq(PC.findDuplicates([prof('content/posts/old.md', '旧タイトル', LONG, '2026-10-01T10:00:00+09:00'), prof('content/posts/new.md', '全然ちがう見出し', LONG + '追記。', '2026-11-01T10:00:00+09:00')]).map((x) => x.rule), ['DUPLICATE_BODY']);
  eq(PC.findDuplicates([prof('content/posts/old.md', '【浦安】ホテルのクリスマスアフタヌーンティー2026', '<p>a</p>', '2026-10-01T10:00:00+09:00'), prof('content/posts/new.md', '【舞浜】ホテルのクリスマスアフタヌーンティー2026！', '<p>b</p>', '2026-11-01T10:00:00+09:00')]).map((x) => x.rule + ':' + x.severity), ['SIMILAR_POST:warning']);
});
t('既存記事どうし・別言語・別の話題は対象外、新規どうしは後の記事だけ指摘', () => {
  eq(PC.findDuplicates([prof('content/posts/a.md', 'X祭り', LONG, '2026-09-01T10:00:00+09:00'), prof('content/posts/b.md', 'X祭り', LONG, '2026-10-01T10:00:00+09:00')]), []);
  eq(PC.findDuplicates([prof('content/posts/a.md', 'X祭り', LONG, '2026-09-01T10:00:00+09:00'), prof('content/posts/a.en.md', 'X祭り', LONG, '2026-11-01T10:00:00+09:00', 'en')]), []);
  eq(PC.findDuplicates([prof('content/posts/a.md', '浦安の図書館が休館', '<p>a</p>', '2026-09-01T10:00:00+09:00'), prof('content/posts/b.md', '新浦安駅前でマルシェ', '<p>b</p>', '2026-11-01T10:00:00+09:00')]), []);
  eq(PC.findDuplicates([prof('content/posts/n2.md', 'Y祭り', '<p>a</p>', '2026-11-02T10:00:00+09:00'), prof('content/posts/n1.md', 'Y祭り', '<p>b</p>', '2026-11-01T10:00:00+09:00')]).map((x) => x.path), ['content/posts/n2.md']);
});

console.log('■ 追加検査（P0-B）: URL 衝突の説明と slug の提案');
const infoOf = (o) => Object.fromEntries(Object.entries(o).map(([p, v]) => [p, { data: v.data, dp: R.parseDate(v.date), lang: R.langOfPath(p) }]));
t('slug の重複 → 「slug が既存記事（…）と重複しています」と続報用の slug 案（<slug>-<YYYYMMDD>）', () => {
  const info = infoOf({ 'content/posts/20261001-foo.md': { data: { slug: 'foo' }, date: '2026-10-01T10:00:00+09:00' }, 'content/posts/20261101-foo.md': { data: { slug: 'foo' }, date: '2026-11-01T10:00:00+09:00' } });
  const r = PC.describeCollision({ url: '/posts/foo/', files: ['content/posts/20261001-foo.md', 'content/posts/20261101-foo.md'], via: ['content/posts/20261001-foo.md:url', 'content/posts/20261101-foo.md:url'] }, info, undefined, new Set(['/posts/foo/']));
  eq(r.map((x) => x.path), ['content/posts/20261101-foo.md']); eq(r[0].suggestion, 'foo-20261101');
  if (!/^slug が既存記事（content\/posts\/20261001-foo\.md）と重複しています（URL: \/posts\/foo\/）。.*slug: "foo-20261101"/.test(r[0].msg)) throw new Error(r[0].msg);
});
t('slug 案が使用中なら -2 を付ける。元の slug の末尾の日付は付け直す・翻訳版は言語の URL で確かめる', () => {
  eq(PC.suggestSlug('content/posts/20261101-foo.md', { data: { slug: 'foo' }, dp: R.parseDate('2026-11-01T10:00:00+09:00'), lang: 'ja' }, new Set(['/posts/foo-20261101/'])), 'foo-20261101-2');
  eq(PC.suggestSlug('content/posts/20261101-foo.md', { data: { slug: 'foo-20261101' }, dp: R.parseDate('2026-11-01T10:00:00+09:00'), lang: 'ja' }, new Set()), 'foo-20261101-2');
  eq(PC.suggestSlug('content/posts/20261101-foo.en.md', { data: { slug: 'foo' }, dp: R.parseDate('2026-11-01T10:00:00+09:00'), lang: 'en' }, new Set(['/en/posts/foo-20261101/'])), 'foo-20261101-2');
});
t('既知の衝突に加わったファイル・aliases による衝突・ファイル名由来の URL も具体的に示す', () => {
  const info = infoOf({ 'content/posts/a.md': { data: { slug: 'x' }, date: '2026-11-05T10:00:00+09:00' }, 'content/posts/b.md': { data: { slug: 'y', aliases: ['/posts/x/'] }, date: '2026-09-01T10:00:00+09:00' } });
  /* known に a.md があれば、日付に関係なく b.md が後から加わった側 */
  const r = PC.describeCollision({ url: '/posts/x/', files: ['content/posts/a.md', 'content/posts/b.md'], via: ['content/posts/a.md:url', 'content/posts/b.md:alias'] }, info, new Set(['content/posts/a.md']), new Set());
  eq(r.map((x) => x.path), ['content/posts/b.md']);
  if (!/^aliases の「\/posts\/x\/」が既存記事（content\/posts\/a\.md）と重複しています.*aliases から「\/posts\/x\/」を外してください$/.test(r[0].msg)) throw new Error(r[0].msg);
  const info2 = infoOf({ 'content/posts/old.md': { data: { slug: 'abc' }, date: '2026-09-01T10:00:00+09:00' }, 'content/posts/abc.md': { data: {}, date: '2026-11-01T10:00:00+09:00' } });
  const r2 = PC.describeCollision({ url: '/posts/abc/', files: ['content/posts/abc.md', 'content/posts/old.md'], via: ['content/posts/old.md:url', 'content/posts/abc.md:url'] }, info2, undefined, new Set());
  if (!/^ファイル名から決まる URL が既存記事（content\/posts\/old\.md）と重複しています/.test(r2[0].msg)) throw new Error(r2[0].msg);
});

console.log('■ 追加検査（P0-B）: validate-content.mjs の結合（最小サイト・Hugo 不要）');
/* 一時ディレクトリに content と post-rules.js だけを置き、validate-content.mjs をそのまま実行する（hugo list は手書きの CSV） */
const VC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../validate-content.mjs');
const runVc = (files, extraArgs) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-p0b-'));
  try {
    fs.mkdirSync(path.join(dir, 'static/tools'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'static/tools/post-rules.js'), path.join(dir, 'static/tools/post-rules.js'));
    const csv = ['path,slug,title,date,expiryDate,publishDate,draft,permalink,kind,section'];
    for (const [p, body] of Object.entries(files)) {
      fs.mkdirSync(path.join(dir, path.dirname(p)), { recursive: true });
      fs.writeFileSync(path.join(dir, p), body);
      const slug = (/^slug: "([^"]+)"/m.exec(body) || [])[1];
      csv.push([p, slug || '', 't', '', '', '', 'false', 'https://urayasu-portal.com/posts/' + (slug || path.basename(p, '.md')) + '/', 'page', 'posts'].join(','));
    }
    fs.writeFileSync(path.join(dir, 'list.csv'), csv.join('\n') + '\n');
    let code = 0, out = '';
    try { out = execFileSync(process.execPath, [VC, '--hugo-list', 'list.csv', '--now', '2026-11-01T20:30:00+09:00', '--json', 'out.json', '--known', 'none.json'].concat(extraArgs || []), { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_EVENT_NAME: '' } }); }
    catch (e) { code = e.status; out = String(e.stdout); }
    return { code, out, json: JSON.parse(fs.readFileSync(path.join(dir, 'out.json'), 'utf8')) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const SHOP_NEW = NEW_OK.replace('  - "イベント"', '  - "開店・閉店"').replace('eventDate: "2026-11-10"\neventKind: "event"\nhideEventBox: true\n', '');
const OLD_POST = NB('2026-10-20T10:00:00+09:00').replace('slug: "new-test"', 'slug: "old"').replace('title: "【浦安市】新規テスト記事、11月10日に開催"', 'title: "【浦安市】以前の記事"');
const vcRules = (j) => j.newErrors.map((e) => e.path.split('/').pop() + ':' + e.rule).sort();
t('既存記事だけなら新しい不備 0 件（既存の店舗記事の shopStatus 無しは警告のまま）', () => {
  const r = runVc({ 'content/posts/20261020-old.md': OLD_POST, 'content/posts/20261020-shop.md': SHOP_NEW.replace('2026-11-01T18:00', '2026-10-20T18:00').replace('"new-test"', '"shop-old"').replace('新規テスト記事', '店舗の記事') });
  eq(r.code, 0); eq(vcRules(r.json), []); eq(r.json.warnings.SHOPSTATUS_MISSING, 1); eq(r.json.strictPosts, 0);
});
t('新規記事: 先頭の空白・shopStatus 無し（エラーに昇格）・公開されない date・slug 重複をまとめて検出し、終了コード 1', () => {
  const r = runVc({
    'content/posts/20261020-old.md': OLD_POST,
    'content/posts/20261101-ws.md': '\n' + NEW_OK.replace('"new-test"', '"ws-test"').replace('新規テスト記事', '空白の記事'),
    'content/posts/20261101-shop.md': SHOP_NEW.replace('"new-test"', '"shop-new"').replace('新規テスト記事', '新しい店舗'),
    'content/posts/20261101-late.md': TODAY_LATE.replace('"new-test"', '"late"').replace('新規テスト記事', '遅い記事'),
    'content/posts/20261101-dup.md': NEW_OK.replace('"new-test"', '"old"').replace('新規テスト記事', '重複の記事')
  });
  eq(r.code, 1);
  eq(vcRules(r.json), ['20261101-late.md:DATE_NOT_PUBLISHED', '20261101-shop.md:SHOPSTATUS_MISSING', '20261101-ws.md:FM_LEADING_WHITESPACE']);
  eq(r.json.newCollisions.length, 1);
  const det = r.json.collisionDetails[0].details;
  eq(det.map((x) => x.path), ['content/posts/20261101-dup.md']); eq(det[0].suggestion, 'old-20261101');
  if (!/slug が既存記事（content\/posts\/20261020-old\.md）と重複しています/.test(r.out)) throw new Error('Summary に衝突の説明が無い');
  if (!/shopStatus がありません.*2026-11-01 以降の開店・閉店の記事は必須/.test(r.json.newErrors.find((e) => e.rule === 'SHOPSTATUS_MISSING').msg)) throw new Error('昇格の注記が無い');
  if (!/新規記事ルールの対象（date が 2026-11-01 以降の posts）: 4 本/.test(r.out)) throw new Error('対象本数の行が無い');
});
t('--event schedule では公開されない date を警告にし、Summary の「記事の注意」に出す', () => {
  const r = runVc({ 'content/posts/20261020-old.md': OLD_POST, 'content/posts/20261101-late.md': TODAY_LATE.replace('"new-test"', '"late"') }, ['--event', 'schedule']);
  eq(r.code, 0); eq(r.json.postWarnings.map((w) => w.rule), ['DATE_NOT_PUBLISHED']);
  if (!/### 記事の注意（警告。失敗にはしません）/.test(r.out)) throw new Error('記事の注意の節が無い');
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

/* 会場・主催者（工程1a PR 4）: 既存記事の実データで、新しい規則に当たるものが無いこと */
const TF_CODE = /^(EVENTLOCATION|ORGANIZER)_/;
const tfFound = [], tfUsing = {};
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const d = R.parseFrontmatter(text).data;
  R.EVENT_TEXT_FIELDS.forEach((k) => { if (d[k] !== undefined) tfUsing[k] = (tfUsing[k] || 0) + 1; });
  const s = R.validatePost(text, { path: 'content/posts/' + f, isNew: true, now: NOW, skipBodyChecks: true, skipLastmodChecks: true });
  s.errors.concat(s.warnings).filter((e) => TF_CODE.test(e.code)).forEach((e) => tfFound.push(f + ' → ' + e.code));
}
t('既存記事に、会場・主催者の規則でエラー・警告になる値が無い', () => { if (tfFound.length) throw new Error(tfFound.length + ' 件: ' + tfFound.slice(0, 5).join(' / ')); });
console.log('       （参考）会場・主催者を持つ既存記事: ' + (Object.entries(tfUsing).map(([k, n]) => k + ' ' + n).join('、') || 'なし'));

/* 追加検査（P0-B）: 既存記事（date が STRICT_FROM より前）に新しいエラーが出ないこと。
   参考として、開始日を設けなかった場合に何本が当たるかも表示する（内部リンクの検査は URL 一覧が要るので CI の validate-content.mjs で確認） */
const p0b = [], p0bAll = {};
const profs = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const p = 'content/posts/' + f;
  const lw = PC.leadingWhitespace(text);
  if (lw.found) p0b.push(f + ' → FM_LEADING_WHITESPACE');
  const fm = R.parseFrontmatter(lw.found ? lw.stripped : text);
  const dp = R.parseDate(fm.data.date);
  const base = { path: p, lang: R.langOfPath(p), fm, dp, now: Date.now(), siteUrls: null, staticExists: PC.staticChecker(ROOT), eventName: 'push', bodyLineOffset: 0 };
  PC.checkPost({ ...base, strict: PC.isStrict(dp) }).filter((x) => x.severity === 'error').forEach((x) => p0b.push(f + ' → ' + x.rule));
  PC.checkPost({ ...base, strict: true }).filter((x) => x.severity === 'error').forEach((x) => { p0bAll[x.rule] = (p0bAll[x.rule] || 0) + 1; });
  profs.push(PC.dupProfile({ path: p, lang: base.lang, title: fm.data.title, body: fm.body, epoch: dp.ok ? dp.epochMs : Infinity, strict: PC.isStrict(dp) }));
}
PC.findDuplicates(profs).filter((x) => x.severity === 'error').forEach((x) => p0b.push(x.path + ' → ' + x.rule));
t('既存記事に、追加検査（P0-B）で新たにエラーになるものが無い', () => { if (p0b.length) throw new Error(p0b.length + ' 件: ' + p0b.slice(0, 5).join(' / ')); });
console.log('       （参考）開始日（' + PC.STRICT_FROM + '）を設けずに全記事へ適用した場合のエラー: ' + (Object.entries(p0bAll).map(([k, n]) => k + ' ' + n).join('、') || 'なし'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
