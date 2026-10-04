#!/usr/bin/env node
/*
 * snapshot.mjs — 改修前後を機械比較するための基準データを作る（工程0.5で導入）
 *
 * 使い方（リポジトリ直下で実行。ビルドは作業ツリーを汚さないよう別ディレクトリへ出す）:
 *   hugo list all > /tmp/list.csv
 *   HUGO_ENVIRONMENT=production hugo --minify --baseURL https://urayasu-portal.com/ \
 *        --destination /tmp/pub --printPathWarnings > /tmp/build.log 2>&1
 *   node scripts/baseline/snapshot.mjs --public /tmp/pub --hugo-list /tmp/list.csv --hugo-log /tmp/build.log --out <出力先>
 *   node scripts/baseline/compare.mjs <改修前の出力先> <改修後の出力先>
 *
 * 出力（すべて UTF-8・LF・行はソート済み＝diff しやすい）:
 *   content-inventory.tsv  … content 配下の全ファイル: path / lang / kind / url / title / slug / date / lastmod / category / eventDate / draft
 *   pages.tsv              … 生成 HTML（エイリアス除く）: path / title / canonical / robots / hreflang / json-ld 型 / h1数
 *   aliases.tsv            … エイリアス HTML: path / 転送先
 *   sitemap-urls.txt       … 言語別 sitemap.xml の <loc>
 *   affiliate-links.tsv    … 予約・アフィリエイト系リンク: ページ / ASP / URL（クエリ込み）
 *   duplicate-paths.txt    … Hugo の重複出力パス警告
 *   build-warnings.txt     … Hugo の WARN / ERROR 行
 *   summary.json           … 件数のまとめ
 * 認証情報は扱わない（公開 HTML とリポジトリの内容だけを読む）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const R = require(path.join(ROOT, 'static/tools/post-rules.js'));
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const PUB = opt('--public'), OUT = opt('--out');
if (!PUB || !OUT) { console.error('usage: snapshot.mjs --public DIR --out DIR [--hugo-list CSV] [--hugo-log LOG]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const nfc = (s) => String(s).normalize('NFC');
const tsv = (cells) => cells.map((c) => String(c == null ? '' : c).replace(/[\t\r\n]+/g, ' ')).join('\t');
const write = (name, header, rows) => {
  rows = [...new Set(rows)].sort();
  fs.writeFileSync(path.join(OUT, name), (header ? header + '\n' : '') + rows.join('\n') + (rows.length ? '\n' : ''));
  return rows.length;
};
const walk = (dir, pred, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, pred, out); else if (pred(e.name)) out.push(p);
  }
  return out;
};
const relTo = (base, p) => nfc(path.relative(base, p).split(path.sep).join('/'));

/* ── content 一覧 ── */
function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const list = new Map();
if (opt('--hugo-list')) {
  const rows = parseCsv(fs.readFileSync(opt('--hugo-list'), 'utf8'));
  const h = rows.shift();
  for (const r of rows) if (r[h.indexOf('path')]) list.set(nfc(r[h.indexOf('path')].replace(/\\/g, '/')), { url: R.normUrl(r[h.indexOf('permalink')]), kind: r[h.indexOf('kind')] });
}
const inv = [];
for (const abs of walk(path.join(ROOT, 'content'), (n) => n.endsWith('.md'))) {
  const rel = relTo(ROOT, abs);
  const fm = R.parseFrontmatter(fs.readFileSync(abs, 'utf8'));
  const d = fm.data;
  const l = list.get(rel) || {};
  const arr = (v) => (Array.isArray(v) ? v.join('|') : v && typeof v === 'object' ? '' : v);
  inv.push(tsv([rel, R.langOfPath(rel), l.kind || '', l.url || '', d.title, d.slug, d.date, d.lastmod, Array.isArray(d.categories) ? d.categories[0] : d.categories, arr(d.eventDate), d.draft]));
}
const nInv = write('content-inventory.tsv', 'path\tlang\tkind\turl\ttitle\tslug\tdate\tlastmod\tcategory\teventDate\tdraft', inv);

/* ── 生成 HTML ── */
const pages = [], aliases = [], aff = [];
const ASP = [
  ['rakuten', /hb\.afl\.rakuten\.co\.jp|travel\.rakuten/], ['jalan', /jalan\.net/], ['yahoo', /travel\.yahoo/],
  ['booking', /booking\.com/], ['agoda', /agoda\.com/], ['trip', /trip\.com/], ['expedia', /expedia\./],
  ['travelpayouts', /tp\.media|tp\.st/], ['kkday', /kkday\.com/], ['klook', /klook\.com/],
  ['valuecommerce', /valuecommerce\.com/], ['a8', /a8\.net/], ['asoview', /asoview\.com/], ['akippa', /akippa/]
];
const aspOf = (u) => (ASP.find(([, re]) => re.test(u)) || [''])[0];
const decodeEnt = (s) => s.replace(/&amp;/g, '&').replace(/&#43;/g, '+').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
for (const abs of walk(PUB, (n) => n === 'index.html' || n === '404.html')) {
  const rel = '/' + relTo(PUB, abs).replace(/index\.html$/, '');
  const html = fs.readFileSync(abs, 'utf8');
  const refresh = /http-equiv="refresh" content="0; url=([^"]+)"/.exec(html);
  if (refresh && html.length < 2000) { aliases.push(tsv([rel, decodeEnt(refresh[1])])); continue; }
  const g = (re) => { const m = re.exec(html); return m ? decodeEnt(m[1]) : ''; };
  const hreflang = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => m[1] + '=' + m[2].replace('https://urayasu-portal.com', '')).join(' ');
  const types = [...html.matchAll(/"@type":\s*"([A-Za-z]+)"/g)].map((m) => m[1]);
  const typeSet = [...new Set(types)].sort().join(',');
  pages.push(tsv([rel, g(/<title>([^<]*)<\/title>/), g(/<link rel="canonical" href="([^"]*)"/), g(/<meta name="robots" content="([^"]*)"/), hreflang, typeSet, (html.match(/<h1[\s>]/g) || []).length]));
  for (const m of html.matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^"]+)"[^>]*>/g)) {
    const u = decodeEnt(m[1]); const a = aspOf(u);
    if (a) aff.push(tsv([rel, a, u, /rel="[^"]*sponsored/.test(m[0]) ? 'sponsored' : '']));
  }
}
const nPages = write('pages.tsv', 'path\ttitle\tcanonical\trobots\threflang\tjsonld\th1', pages);
const nAlias = write('aliases.tsv', 'path\ttarget', aliases);
const nAff = write('affiliate-links.tsv', 'page\tasp\turl\trel', aff);

/* ── サイトマップ ── */
const locs = [];
for (const abs of walk(PUB, (n) => n === 'sitemap.xml')) {
  const xml = fs.readFileSync(abs, 'utf8');
  if (/<sitemapindex/.test(xml)) continue;
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) locs.push(m[1].replace('https://urayasu-portal.com', ''));
}
const nLoc = write('sitemap-urls.txt', '', locs);

/* ── ビルドログ ── */
let dups = [], warns = [];
if (opt('--hugo-log')) {
  const log = fs.readFileSync(opt('--hugo-log'), 'utf8').split('\n');
  for (const line of log) {
    const m = /Duplicate target paths:\s*(.*)$/.exec(line);
    if (m) dups.push(...m[1].split(/,\s*/).map((p) => p.trim().replace(/\\/g, '/')));
    else if (/^(WARN|ERROR)/.test(line)) warns.push(line.trim());
  }
}
const nDup = write('duplicate-paths.txt', '', dups);
write('build-warnings.txt', '', warns);

const byAsp = {};
aff.forEach((r) => { const a = r.split('\t')[1]; byAsp[a] = (byAsp[a] || 0) + 1; });
const summary = {
  generatedAt: new Date().toISOString(),
  contentFiles: nInv, pages: nPages, aliasPages: nAlias, sitemapUrls: nLoc,
  affiliateLinks: nAff, affiliateLinksByAsp: byAsp, duplicateTargetPaths: nDup, buildWarnings: warns.length
};
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
