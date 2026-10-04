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
t('eventDate の形式（範囲・配列は可、不正は警告）', () => {
  eq(codes(v(GOOD.replace('eventDate: "2026-10-10"', 'eventDate: "2026-10-10/2026-10-12"')).warnings), []);
  eq(codes(v(GOOD.replace('eventDate: "2026-10-10"', 'eventDate:\n  - "2026-10-10"\n  - "2026-10-11"')).warnings), []);
  eq(codes(v(GOOD.replace('eventDate: "2026-10-10"', 'eventDate: "10月10日"')).warnings), ['EVENTDATE_FORMAT']);
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
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
