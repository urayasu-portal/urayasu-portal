#!/usr/bin/env node
/*
 * 多言語トップ /en/・/zh/・/zh-tw/・/ko/ の技術 SEO の検査（工程6 Phase 6B-1B）。ビルド済みサイトを全ページ調べる:
 *   node scripts/validate/langroot-audit.mjs --public public [--base https://urayasu-portal.com]
 * 失敗（終了コード 1）にするもの:
 *   - /xx/ が Hugo の alias と同じ最小 HTML でない（canonical と meta refresh の行き先が /xx/travel-guide/、
 *     robots・hreflang・GA なし、html lang が xx）
 *   - 言語別 sitemap に /xx/ がある、または /xx/travel-guide/ が無い
 *   - 日本語トップ / の hreflang（x-default を含む）が /xx/ を指している
 *   - /xx/ を指す内部リンクがある／転送ページ（/xx/ と alias）を指す hreflang・JSON-LD の item・sitemap の loc がある
 *     （本文中の alias へのリンクはこの検査の対象外）
 *   - hreflang の行き先が実在しない（転送ページを含む）、自分自身を含まない、相互になっていない
 * 依存ライブラリなし。
 */
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PUB = arg('--public', 'public');
const BASE = arg('--base', 'https://urayasu-portal.com').replace(/\/$/, '');
const LANGS = ['en', 'zh', 'zh-tw', 'ko'];
const errors = [];
const fail = (m) => { if (errors.length < 200) errors.push(m); else if (errors.length === 200) errors.push('…（以降省略）'); };

const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.html')) out.push(p); } return out; };
const toUrlPath = (f) => '/' + path.relative(PUB, f).replace(/\\/g, '/').replace(/(^|\/)index\.html$/, '$1');
const isRedirect = (html) => html.length < 2000 && /<meta http-equiv="refresh"/.test(html);

// 全ページを読み、転送ページ（/xx/ と alias）とふつうのページに分ける
const pages = new Map(); // urlPath -> html
const redirects = new Set();
for (const f of walk(PUB)) {
  const p = toUrlPath(f);
  const html = fs.readFileSync(f, 'utf8');
  if (isRedirect(html)) redirects.add(p); else pages.set(p, html);
}
const norm = (href) => {
  if (!href) return null;
  href = href.replace(/&amp;/g, '&').replace(/&#43;/g, '+').replace(/&#39;/g, "'");
  if (href.startsWith(BASE + '/')) href = href.slice(BASE.length);
  if (!href.startsWith('/') || href.startsWith('//')) return null;
  href = href.replace(/[?#].*$/, '');
  // ファイル名と比べるため区切りごとに戻す（タグ名の %23＝# なども）
  try { return href.split('/').map((s) => decodeURIComponent(s)).join('/'); } catch { return href; }
};
// ページ送りの2ページ目以降（/page/N/）は、Hugo の .AllTranslations が1ページ目を指すため hreflang の自己参照・相互の検査から外す
// （このフェーズ以前からの仕様。行き先の実在と転送ページでないことは検査する）
const isPager = (p) => /\/page\/\d+\/$/.test(p);

// 1. /xx/ の最小 HTML
for (const l of LANGS) {
  const f = path.join(PUB, l, 'index.html');
  const html = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const dest = `${BASE}/${l}/travel-guide/`;
  if (!html) { fail(`/${l}/: ページが無い`); continue; }
  if (!isRedirect(html)) fail(`/${l}/: 転送用の最小 HTML になっていない（${html.length} バイト）`);
  if (!html.includes(`<link rel="canonical" href="${dest}">`)) fail(`/${l}/: canonical が ${dest} でない`);
  if (!html.includes(`<meta http-equiv="refresh" content="0; url=${dest}">`)) fail(`/${l}/: meta refresh の行き先が ${dest} でない`);
  if (!new RegExp(`<html lang="${l}">`).test(html)) fail(`/${l}/: html lang が ${l} でない`);
  if (/<meta name="robots"/.test(html)) fail(`/${l}/: robots がある`);
  if (/hreflang=/.test(html)) fail(`/${l}/: hreflang がある`);
  if (/googletagmanager|gtag\(/.test(html)) fail(`/${l}/: GA を読み込んでいる`);
}

// 2. sitemap
for (const l of LANGS) {
  const f = path.join(PUB, l, 'sitemap.xml');
  if (!fs.existsSync(f)) { fail(`/${l}/sitemap.xml が無い`); continue; }
  const xml = fs.readFileSync(f, 'utf8');
  if (xml.includes(`<loc>${BASE}/${l}/</loc>`)) fail(`/${l}/sitemap.xml に /${l}/ がある`);
  if (!xml.includes(`<loc>${BASE}/${l}/travel-guide/</loc>`)) fail(`/${l}/sitemap.xml に /${l}/travel-guide/ が無い`);
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) { const p = norm(m[1]); if (p && redirects.has(p)) fail(`/${l}/sitemap.xml に転送ページ ${p} がある`); }
}

// 3〜5. 全ページのリンク・hreflang・JSON-LD
const altRe = /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g;
let nLinks = 0, nAlt = 0;
const langRoot = new Set(LANGS.map((l) => `/${l}/`));
for (const [p, html] of pages) {
  for (const m of html.matchAll(/<a\b[^>]*?\shref="([^"]+)"/g)) {
    const t = norm(m[1].replace(/&amp;/g, '&'));
    if (!t) continue;
    nLinks++;
    if (langRoot.has(t)) fail(`${p}: 転送ページ ${t} へのリンク`);
  }
  for (const m of html.matchAll(/"item":\s*"([^"]+)"/g)) {
    const t = norm(m[1]);
    if (t && redirects.has(t)) fail(`${p}: JSON-LD の item が転送ページ ${t}`);
  }
  const alts = [...html.matchAll(altRe)].map((m) => ({ lang: m[1], href: m[2], path: norm(m[2]) }));
  if (alts.length === 0) continue;
  nAlt++;
  const canon = (html.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
  const self = norm(canon) || p;
  const pager = isPager(p);
  if (!pager && !alts.some((a) => a.lang !== 'x-default' && a.path === self)) fail(`${p}: hreflang に自分自身が無い`);
  for (const a of alts) {
    if (!a.path) { fail(`${p}: hreflang ${a.lang} がサイト外 ${a.href}`); continue; }
    if (redirects.has(a.path)) { fail(`${p}: hreflang ${a.lang} が転送ページ ${a.path}`); continue; }
    const target = pages.get(a.path);
    if (target === undefined) { fail(`${p}: hreflang ${a.lang} の行き先 ${a.path} が無い`); continue; }
    if (a.lang === 'x-default' || a.path === self || pager) continue;
    const back = [...target.matchAll(altRe)].some((m) => norm(m[2]) === self);
    if (!back) fail(`${p}: hreflang ${a.lang} → ${a.path} が相互になっていない`);
  }
}
const top = pages.get('/') || '';
for (const m of top.matchAll(altRe)) { const t = norm(m[2]); if (t && langRoot.has(t)) fail(`/: hreflang ${m[1]} が ${t} を指している`); }

console.log(`ページ ${pages.size}・転送ページ ${redirects.size}・内部リンク ${nLinks}・hreflang のあるページ ${nAlt}`);
if (errors.length) {
  console.error(`\n不合格 ${errors.length} 件:`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('合格（/xx/ は最小 HTML・sitemap 除外・/ の hreflang は ja のみ・転送ページへの内部リンク0・hreflang は実在かつ相互）');
