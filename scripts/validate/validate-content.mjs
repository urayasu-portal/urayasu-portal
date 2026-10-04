#!/usr/bin/env node
/*
 * validate-content.mjs — posts の frontmatter 検証と URL 衝突検出（CI 用）
 *
 * ルール本体は static/tools/post-rules.js（投稿ツールと共通）。このスクリプトはそれを全記事に適用し、
 * scripts/validate/known-issues.json に記録済みの「既存の不備」と照合して、新たに発生した不備だけを失敗として扱う。
 *
 * 使い方（リポジトリ直下で実行）:
 *   hugo list all > /tmp/hugo-list.csv
 *   hugo --printPathWarnings --destination /tmp/pub 2>&1 | tee /tmp/hugo-build.log
 *   node scripts/validate/validate-content.mjs --hugo-list /tmp/hugo-list.csv --hugo-log /tmp/hugo-build.log
 *
 * オプション:
 *   --hugo-list FILE   `hugo list all` の CSV（Hugo が実際に生成する URL）。省略時は hugo を実行して取得
 *   --hugo-log FILE    `hugo --printPathWarnings` のログ（重複出力パスの検出用）。省略時はこの検査を省略
 *   --known FILE       既存の不備リスト（既定 scripts/validate/known-issues.json）
 *   --write-known      現在の不備を既存リストとして書き出す（初回・解消後の更新用。衝突の id/plan は引き継ぐ）
 *   --now ISO          現在時刻の上書き（テスト用）
 *   --json FILE        結果を JSON で保存
 *   --summary FILE     Markdown の結果を追記（GitHub Actions の $GITHUB_STEP_SUMMARY）
 *
 * 終了コード: 0 = 新しい不備なし / 1 = 新しい不備あり / 2 = 実行エラー
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const R = require(path.join(ROOT, 'static/tools/post-rules.js'));

/* ── 引数 ── */
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name) => args.includes(name);
const KNOWN_FILE = opt('--known') || 'scripts/validate/known-issues.json';
const NOW = opt('--now') ? Date.parse(opt('--now')) : Date.now();
const isGha = !!process.env.GITHUB_ACTIONS;

const nfc = (s) => String(s).normalize('NFC');
const rel = (p) => nfc(path.relative(ROOT, p).split(path.sep).join('/'));

/* ── content 配下の .md を列挙 ── */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
  return out;
}
const allMd = walk(path.join(ROOT, 'content')).map((p) => ({ abs: p, rel: rel(p) }));
const isPost = (r) => r.startsWith('content/posts/') && !/\/_index(\.[a-z-]+)?\.md$/.test(r);

/* ── CSV（hugo list all）── */
function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function loadHugoList() {
  let csv;
  const f = opt('--hugo-list');
  if (f) csv = fs.readFileSync(f, 'utf8');
  else {
    try { csv = execFileSync('hugo', ['list', 'all'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
    catch (e) { csv = ''; }
  }
  /* frontmatter の構文エラーがあると Hugo 自体が失敗し CSV が空になる。その場合も検証は続ける（URL は slug から推定） */
  if (!csv.trim()) { console.error('⚠ hugo list の結果が空です（Hugo のビルドエラーの可能性）。URL は frontmatter から推定して検査します'); return null; }
  const rows = parseCsv(csv);
  const head = rows.shift() || [];
  const iPath = head.indexOf('path'), iLink = head.indexOf('permalink'), iKind = head.indexOf('kind');
  if (iPath < 0 || iLink < 0) { console.error('⚠ hugo list の CSV 形式が想定と異なります（' + head.join(',').slice(0, 80) + '）。URL は frontmatter から推定して検査します'); return null; }
  const map = new Map();
  for (const r of rows) {
    if (!r[iPath]) continue;
    map.set(nfc(r[iPath].replace(/\\/g, '/')), { url: R.normUrl(r[iLink]), kind: r[iKind] });
  }
  return map;
}

/* ── Hugo の重複出力パス警告 ── */
function loadHugoDuplicates() {
  const f = opt('--hugo-log');
  if (!f) return null;
  const log = fs.readFileSync(f, 'utf8');
  const set = new Set();
  for (const line of log.split('\n')) {
    const m = /Duplicate target paths:\s*(.*)$/.exec(line);
    if (!m) continue;
    for (const part of m[1].split(/,\s*/)) {
      let p = part.replace(/\s*\(\d+\)\s*$/, '').trim().replace(/\\/g, '/');
      if (!p) continue;
      if (p[0] !== '/') p = '/' + p;
      /* ページ送り・RSS は同じ衝突の派生なので本体 URL にまとめる */
      p = p.replace(/\/page\/\d+\/index\.html$/, '/').replace(/\/(index\.html|index\.xml)$/, '/');
      set.add(R.normUrl(p));
    }
  }
  return [...set].sort();
}

/* ── 本体 ── */
const hugoList = loadHugoList();
const hugoDups = loadHugoDuplicates();
const issues = [];            /* { rule, path, msg, severity } */
const urlEntries = [];
const stats = { posts: 0, files: allMd.length, futurePosts: [] };

for (const f of allMd) {
  const text = fs.readFileSync(f.abs, 'utf8');
  const lang = R.langOfPath(f.rel);
  const fm = R.parseFrontmatter(text);
  const hl = hugoList ? hugoList.get(f.rel) : null;
  const url = hl ? hl.url : R.expectedUrl(f.rel, fm.data);
  urlEntries.push({ path: f.rel, url, aliases: R.aliasesOf(fm.data, lang) });

  if (!isPost(f.rel)) {
    if (!fm.ok) fm.errors.forEach((e) => issues.push({ rule: e.code, path: f.rel, msg: e.msg, severity: 'error' }));
    continue;
  }
  stats.posts++;
  const v = R.validatePost(text, { path: f.rel, isNew: true, now: NOW, skipBodyChecks: true, skipLastmodChecks: true });
  v.errors.forEach((e) => issues.push({ rule: e.code, path: f.rel, msg: e.msg, severity: 'error' }));
  v.warnings.forEach((w) => {
    if (w.code === 'DATE_FUTURE' || w.code === 'DATE_FAR_FUTURE') stats.futurePosts.push({ path: f.rel, msg: w.msg });
    issues.push({ rule: w.code, path: f.rel, msg: w.msg, severity: 'warning' });
  });
  if (hugoList && !hl) issues.push({ rule: 'NOT_IN_HUGO_LIST', path: f.rel, msg: 'hugo list に出てこない記事です（Hugo が読み込めていない可能性）', severity: 'error' });
}

/* URL 衝突（Hugo の実 URL ＋ aliases ＋ 明示 url） */
const idx = R.buildUrlIndex(urlEntries);
const collisions = [];
for (const [u, owners] of Object.entries(idx)) {
  const files = [...new Set(owners.map((o) => o.path))].sort();
  if (files.length > 1) collisions.push({ url: u, files, via: owners.map((o) => o.path + ':' + o.via) });
}
collisions.sort((a, b) => a.url.localeCompare(b.url));

/* ── 既存の不備リストと照合 ── */
let known = { issues: {}, collisions: [], hugoDuplicatePaths: [] };
if (fs.existsSync(KNOWN_FILE)) known = JSON.parse(fs.readFileSync(KNOWN_FILE, 'utf8'));
const knownIssue = new Set();
for (const [rule, files] of Object.entries(known.issues || {})) for (const p of files) knownIssue.add(rule + '|' + nfc(p));
const collisionKey = (c) => c.url + '|' + c.files.map(nfc).sort().join('|');
const knownColl = new Map((known.collisions || []).map((c) => [collisionKey(c), c]));
const knownDup = new Set((known.hugoDuplicatePaths || []).map((d) => R.normUrl(typeof d === 'string' ? d : d.url)));

const newErrors = [];
const knownErrors = [];
for (const i of issues.filter((x) => x.severity === 'error')) {
  (knownIssue.has(i.rule + '|' + i.path) ? knownErrors : newErrors).push(i);
}
const newCollisions = collisions.filter((c) => !knownColl.has(collisionKey(c)));
const knownCollisions = collisions.filter((c) => knownColl.has(collisionKey(c))).map((c) => ({ ...c, meta: knownColl.get(collisionKey(c)) }));
const newDups = hugoDups ? hugoDups.filter((d) => !knownDup.has(d)) : [];
/* 既知リストにあるのに今は発生していないもの（解消済み → リストから外せる） */
const currentIssueKeys = new Set(issues.filter((x) => x.severity === 'error').map((i) => i.rule + '|' + i.path));
const resolvedIssues = [...knownIssue].filter((k) => !currentIssueKeys.has(k));
const currentCollKeys = new Set(collisions.map(collisionKey));
/* Hugo の実 URL が取れないときは衝突の「解消」を判定しない（ファイル名由来 URL を推定できないため） */
const currentCollUrls = new Set(collisions.map((c) => c.url));
const resolvedCollisions = hugoList ? (known.collisions || []).filter((c) => !currentCollKeys.has(collisionKey(c)) && !currentCollUrls.has(R.normUrl(c.url))) : [];
/* 既知の衝突 URL に後から加わったファイル＝修正すべき側 */
const knownFilesByUrl = new Map((known.collisions || []).map((c) => [R.normUrl(c.url), new Set(c.files.map(nfc))]));
const markNew = (c) => c.files.map((f) => '`' + f + '`' + (knownFilesByUrl.has(c.url) && !knownFilesByUrl.get(c.url).has(f) ? '（新たに追加）' : '')).join(' / ');
const resolvedDups = hugoDups ? [...knownDup].filter((d) => !hugoDups.includes(d)) : [];

/* ── 既存リストの書き出し ── */
if (flag('--write-known')) {
  const byRule = {};
  for (const i of issues.filter((x) => x.severity === 'error')) (byRule[i.rule] = byRule[i.rule] || []).push(i.path);
  for (const k of Object.keys(byRule)) byRule[k] = [...new Set(byRule[k])].sort();
  const prevColl = known.collisions || [];
  const out = {
    _readme: [
      '既存の不備リスト（CI はここに無い不備だけを「新しい不備」として失敗させる）。',
      '解消したら該当行を消すこと（CI の結果に「解消済み」として表示される）。無期限の許容リストではない。',
      '再生成: node scripts/validate/validate-content.mjs --hugo-list <csv> --hugo-log <log> --write-known'
    ],
    generatedAt: new Date(NOW).toISOString(),
    issues: byRule,
    collisions: collisions.map((c) => {
      const prev = prevColl.find((p) => p.url === c.url);
      return { id: prev ? prev.id : '', url: c.url, files: c.files, status: prev ? prev.status : 'pending-approval', plan: prev ? prev.plan : '' };
    }),
    hugoDuplicatePaths: hugoDups || known.hugoDuplicatePaths || []
  };
  fs.writeFileSync(KNOWN_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log('既存の不備リストを書き出しました: ' + KNOWN_FILE);
}

/* ── 出力 ── */
const warnCount = {};
issues.filter((x) => x.severity === 'warning').forEach((w) => { warnCount[w.rule] = (warnCount[w.rule] || 0) + 1; });
const knownCount = {};
knownErrors.forEach((e) => { knownCount[e.rule] = (knownCount[e.rule] || 0) + 1; });

const failed = newErrors.length + newCollisions.length + newDups.length > 0;
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

console.log(`検査対象: content 配下 ${stats.files} ファイル（うち posts ${stats.posts} 本）`);
if (isGha) {
  newErrors.forEach((e) => console.log(`::error file=${e.path},title=${e.rule}::${esc(e.msg)}`));
  newCollisions.forEach((c) => console.log(`::error file=${c.files[c.files.length - 1]},title=URL_COLLISION::${esc(c.url + ' を複数のファイルが使っています: ' + c.files.join(' / '))}`));
  newDups.forEach((d) => console.log(`::error title=HUGO_DUPLICATE_PATH::${esc(d + ' に複数のページが出力されています（Hugo の警告）')}`));
  stats.futurePosts.forEach((f) => console.log(`::notice file=${f.path},title=予約投稿::${esc(f.msg)}`));
}
const lines = [];
lines.push('## 記事データの検証結果');
lines.push('');
lines.push(failed ? '**❌ 新しい不備があります。** 下の「新しい不備」を修正してください（サイトの公開は止めていません）。' : '**✅ 新しい不備はありません。**');
lines.push('');
if (!hugoList) lines.push('> ⚠ **Hugo の URL 一覧を取得できませんでした**（frontmatter の構文エラー等で Hugo が失敗している可能性）。URL 衝突は slug から推定した範囲だけを検査しています。まずビルドのエラーを解消してください。', '');
lines.push(`- 検査対象: content 配下 ${stats.files} ファイル（posts ${stats.posts} 本）`);
lines.push(`- 新しい不備: ${newErrors.length} 件 / 新しい URL 衝突: ${newCollisions.length} 件 / 新しい重複出力パス: ${hugoDups ? newDups.length + ' 件' : '未検査（--hugo-log なし）'}`);
lines.push(`- 既知の不備（known-issues.json で許容中）: ${knownErrors.length} 件 / 既知の URL 衝突: ${knownCollisions.length} 件`);
lines.push(`- 予約投稿（未来の date）: ${stats.futurePosts.length} 本`);
if (resolvedIssues.length || resolvedCollisions.length || resolvedDups.length) lines.push(`- 解消済み（known-issues.json から削除できます）: 不備 ${resolvedIssues.length} 件 / 衝突 ${resolvedCollisions.length} 件 / 重複パス ${resolvedDups.length} 件`);
lines.push('');
if (newErrors.length) {
  lines.push('### 新しい不備');
  lines.push('| ファイル | ルール | 内容 |'); lines.push('|---|---|---|');
  newErrors.forEach((e) => lines.push(`| \`${e.path}\` | ${e.rule} | ${e.msg.replace(/\|/g, '｜')} |`));
  lines.push('');
}
if (newCollisions.length) {
  lines.push('### 新しい URL 衝突（後から追加した記事の slug を変えてください）');
  newCollisions.forEach((c) => lines.push(`- \`${c.url}\` ← ${markNew(c)}`));
  lines.push('');
}
if (newDups.length) {
  lines.push('### 新しい重複出力パス（Hugo）');
  newDups.forEach((d) => lines.push(`- \`${d}\``));
  lines.push('');
}
if (stats.futurePosts.length) {
  lines.push('### 予約投稿（この時刻より後のビルドで公開）');
  stats.futurePosts.forEach((f) => lines.push(`- \`${f.path}\`: ${f.msg}`));
  lines.push('');
}
if (knownCollisions.length) {
  lines.push('### 既知の URL 衝突（運営判断待ち）');
  knownCollisions.forEach((c) => lines.push(`- ${c.meta.id || ''} \`${c.url}\` ← ${c.files.length} ファイル（${c.meta.status || ''}）`));
  lines.push('');
}
if (Object.keys(knownCount).length) {
  lines.push('<details><summary>既知の不備の内訳</summary>');
  lines.push('');
  Object.entries(knownCount).sort().forEach(([k, n]) => lines.push(`- ${k}: ${n}`));
  lines.push('</details>');
  lines.push('');
}
if (Object.keys(warnCount).length) {
  lines.push('<details><summary>警告の内訳（失敗にはしない）</summary>');
  lines.push('');
  Object.entries(warnCount).sort().forEach(([k, n]) => lines.push(`- ${k}: ${n}`));
  lines.push('</details>');
}
const md = lines.join('\n') + '\n';
if (!isGha || !opt('--summary')) console.log(md);
if (opt('--summary')) fs.appendFileSync(opt('--summary'), md);
if (opt('--json')) {
  fs.writeFileSync(opt('--json'), JSON.stringify({
    failed, newErrors, newCollisions, newDups, knownErrors: knownErrors.length, knownCollisions: knownCollisions.map((c) => ({ url: c.url, files: c.files, id: c.meta.id })),
    resolvedIssues, resolvedCollisions, resolvedDups, futurePosts: stats.futurePosts, warnings: warnCount, collisions
  }, null, 2));
}
process.exit(failed ? 1 : 0);
