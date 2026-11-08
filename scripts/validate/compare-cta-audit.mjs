#!/usr/bin/env node
/*
 * ホテル比較マップ（/travel-guide/hotels/compare/、5言語）の予約ボタンの検査（工程2 Phase 2B-2）。ビルド済みサイトを調べる:
 *   node scripts/validate/compare-cta-audit.mjs --public public [--hotels data/hotels.yaml]
 * 失敗（終了コード 1）にするもの:
 *   - 予約ボタン行の置き場 #hcm-book-src が無い、hidden・data-pagefind-ignore が付いていない
 *   - 行（data-book-for）が HOTELS_DATA に無いホテル・重複・ボタンが1個でない
 *   - ボタンの属性: class に lg-book-btn、target="_blank"、rel="sponsored noopener"、data-cta-pos="hotel_compare"、
 *     data-hotel が行の slug と同じ、data-asp が既知の予約サービス名、href が https:// で始まる
 *   - 行の中に onclick がある（カード側で click を止めると affiliate_click が送られないため）
 *   - HOTELS_DATA（JS に埋め込むデータ）に URL の文字列が入っている（予約 URL を JS 側に複製しない）
 *   - 名称のみ掲載（policy: name-only）のホテルが比較マップのデータ・行に出ている（CLAUDE.md の掲載ポリシー）
 *   - 予約ボタンがあるのに広告（PR）表記（.hcm-book-hint）が無い
 *   - data-cta-pos="hotel_compare" が比較マップ以外のページにある
 * 依存ライブラリなし。
 */
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PUB = arg('--public', 'public');
const HOTELS = arg('--hotels', 'data/hotels.yaml');
const LANGS = ['', 'en/', 'zh/', 'zh-tw/', 'ko/'];
const ASPS = new Set(['agoda', 'booking', 'trip', 'expedia', 'rakuten', 'jalan', 'yahoo']);
const errors = [];
const fail = (m) => errors.push(m);

// policy: name-only のホテル名（data/hotels.yaml。"- name:" の後に policy が来る形だけを読む）
const nameOnly = [];
{
  let cur = null;
  for (const line of fs.readFileSync(HOTELS, 'utf8').split(/\r?\n/)) {
    let m;
    if ((m = line.match(/^\s*- name:\s*"([^"]*)"/))) cur = m[1];
    else if (/^\s*policy:\s*name-only\s*$/.test(line) && cur) nameOnly.push(cur);
  }
}
if (nameOnly.length === 0) fail(`${HOTELS}: policy: name-only のホテルが見つからない（読み取りの前提が変わった可能性）`);

const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : null; };
const summary = [];
for (const l of LANGS) {
  const rel = `${l}travel-guide/hotels/compare/index.html`;
  const file = path.join(PUB, rel);
  if (!fs.existsSync(file)) { fail(`${rel}: ページが無い`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const dm = html.match(/var HOTELS_DATA = (\[.*?\]);<\/script>/s);
  if (!dm) { fail(`${rel}: HOTELS_DATA が見つからない`); continue; }
  let data;
  try { data = JSON.parse(dm[1]); } catch (e) { fail(`${rel}: HOTELS_DATA が JSON として読めない: ${e.message}`); continue; }
  const ids = new Set(data.map((h) => h.id));
  if (/https?:\/\//.test(dm[1])) fail(`${rel}: HOTELS_DATA に URL がある（予約 URL を JS に複製しない）`);
  for (const n of nameOnly) if (data.some((h) => h.name === n)) fail(`${rel}: 名称のみ掲載のホテル「${n}」が HOTELS_DATA にある`);

  // 置き場は「開始タグ → 行（空白だけを挟んで連続）→ 閉じタグ」の形。行の中身（ボタン）は div を含まない
  const hm = html.match(/<div id="hcm-book-src"([^>]*)>((?:\s*<div class="tg-pick-actions hcm-book"[^>]*>[\s\S]*?<\/div>)*)\s*<\/div>/);
  if (!hm) { fail(`${rel}: #hcm-book-src が無い（または行以外のものが入っている）`); continue; }
  if (!/\shidden(\s|$)/.test(hm[1] + ' ')) fail(`${rel}: #hcm-book-src に hidden が無い`);
  if (!/\sdata-pagefind-ignore(\s|=|$)/.test(hm[1] + ' ')) fail(`${rel}: #hcm-book-src に data-pagefind-ignore が無い`);
  const rows = [...hm[2].matchAll(/<div class="tg-pick-actions hcm-book" data-book-for="([^"]+)"([^>]*)>([\s\S]*?)<\/div>/g)];
  if (rows.length !== (html.match(/class="tg-pick-actions hcm-book"/g) || []).length) fail(`${rel}: 置き場の外に予約ボタン行がある`);
  const seen = new Set();
  const asp = {};
  for (const [, slug, rest, inner] of rows) {
    if (!ids.has(slug)) fail(`${rel}: 行 ${slug} が HOTELS_DATA に無い`);
    if (seen.has(slug)) fail(`${rel}: 行 ${slug} が重複`);
    seen.add(slug);
    if (/onclick/i.test(rest + inner)) fail(`${rel}: 行 ${slug} に onclick がある`);
    for (const n of nameOnly) if (inner.includes(n)) fail(`${rel}: 名称のみ掲載のホテル「${n}」の予約ボタンがある`);
    const as = [...inner.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
    if (as.length !== 1) { fail(`${rel}: 行 ${slug} のボタンが ${as.length} 個`); continue; }
    const a = as[0];
    const cls = (attr(a, 'class') || '').split(/\s+/);
    if (!cls.includes('lg-book-btn')) fail(`${rel}: ${slug} のボタンに lg-book-btn が無い`);
    if (attr(a, 'target') !== '_blank') fail(`${rel}: ${slug} の target が _blank でない`);
    if (attr(a, 'rel') !== 'sponsored noopener') fail(`${rel}: ${slug} の rel が "sponsored noopener" でない`);
    if (attr(a, 'data-cta-pos') !== 'hotel_compare') fail(`${rel}: ${slug} の data-cta-pos が hotel_compare でない`);
    if (attr(a, 'data-hotel') !== slug) fail(`${rel}: ${slug} の data-hotel が "${attr(a, 'data-hotel')}"`);
    const s = attr(a, 'data-asp');
    if (!ASPS.has(s)) fail(`${rel}: ${slug} の data-asp が不明 "${s}"`);
    if (!/^https:\/\//.test(attr(a, 'href') || '')) fail(`${rel}: ${slug} の href が https:// で始まらない`);
    asp[s] = (asp[s] || 0) + 1;
  }
  const outside = (html.replace(hm[0], '').match(/data-cta-pos="hotel_compare"/g) || []).length;
  if (outside) fail(`${rel}: 置き場の外に hotel_compare のボタンが ${outside} 個（JS 描画以外で出している）`);
  if (rows.length > 0 && !/class="tg-pick-pr hcm-book-hint"/.test(html)) fail(`${rel}: 予約ボタンがあるのに広告（PR）表記が無い`);
  summary.push(`${l || 'ja/'}: ホテル ${data.length}・予約ボタン ${rows.length}（${Object.entries(asp).map(([k, v]) => `${k} ${v}`).join('・')}）`);
}

// 比較マップ以外に hotel_compare が出ていないか（全 HTML）
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.html')) out.push(p); } return out; };
const compareFiles = new Set(LANGS.map((l) => path.join(PUB, `${l}travel-guide/hotels/compare/index.html`)));
for (const f of walk(PUB)) {
  if (compareFiles.has(f)) continue;
  if (fs.readFileSync(f, 'utf8').includes('data-cta-pos="hotel_compare"')) fail(`${path.relative(PUB, f)}: 比較マップ以外に hotel_compare がある`);
}

for (const s of summary) console.log(s);
if (errors.length) {
  console.error(`\n不合格 ${errors.length} 件:`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`合格（name-only ${nameOnly.length} 軒は対象外を確認）`);
