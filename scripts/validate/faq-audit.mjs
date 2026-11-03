#!/usr/bin/env node
/*
 * FAQ 構造化データと画面表示の整合チェック（工程6 Phase 6B-1A）。ビルド済みサイトを全ページ調べる:
 *   node scripts/validate/faq-audit.mjs --public public [--data data/faq_jsonld.yaml] [--json 出力.json]
 * 失敗（終了コード 1）にするもの:
 *   - JSON-LD が JSON.parse できない／1ページに FAQPage が2つ以上
 *   - FAQPage の質問・回答に二重エスケープの残骸（値全体が "…" で囲まれている、\" や \uXXXX が文字として残っている）
 *   - FAQPage の質問が画面の FAQ に無い、または回答が画面の回答と一致しない
 *     （画面の FAQ = 可視ブロック .faq-block／en の設備 FAQ .tg-hotel-faq／本文の FAQ 節〔h2「よくある質問」等の下の h3 か .lg-art-q〕）
 *   - 可視ブロックがあるのに FAQPage が無い、または件数が違う
 *   - 可視ブロックと本文の FAQ 節が同じページにある（二重表示）／id="faq" が2つ以上
 *   - data/faq_jsonld.yaml の確認済み一覧が古い（ページが無い・可視ブロックのページになった・載せた質問が出ていない）
 * 一致の判定は、タグを除き・文字参照を戻し・空白を詰め・引用符の字形（' と ’ など）をそろえた文字列の完全一致
 * （Markdown 記法や言い回しの差は吸収しない）。依存ライブラリなし。
 */
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PUB = arg('--public', 'public');
const DATA = arg('--data', 'data/faq_jsonld.yaml');
const JSON_OUT = arg('--json', '');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m));
const text = (html) => decode(html.replace(/<a hidden class="?anchor"?[^>]*>#<\/a>/g, '').replace(/<[^>]+>/g, ' '));
// 空白を詰め、Markdown 描画の typographer が変える引用符の字形（' → ’ など）だけを同一視する
const norm = (s) => s.replace(/\s+/g, '').replace(/[‘’‚‛]/g, "'").replace(/[“”„]/g, '"');
const FAQ_H = /(よくある質問|FAQ|Frequently asked|常见问题|常見問題|자주 묻는)/i;

// data/faq_jsonld.yaml（このリポジトリで決めた形だけを読む小さな読み取り）
function readAllowlist(file) {
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  let cur = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    let m;
    if ((m = line.match(/^  (\/\S*\/):\s*(all)?\s*(#.*)?$/))) { cur = m[1]; out.set(cur, m[2] ? 'all' : []); }
    else if ((m = line.match(/^    - "((?:[^"\\]|\\.)*)"\s*$/)) && cur && Array.isArray(out.get(cur))) out.get(cur).push(m[1].replace(/\\(.)/g, '$1'));
  }
  return out;
}

const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'pagefind') walk(p); } else if (e.name === 'index.html') files.push(p); } })(PUB);

const errors = [];
const err = (url, msg) => errors.push(url + ' : ' + msg);
const stat = { pages: 0, faqPages: 0, faqQuestions: 0, blockPages: 0, facilityPages: 0, bodyPages: 0, bodyFaqWithoutLd: 0 };
const seenUrls = new Map();

for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  if (html.length < 2000 && /http-equiv="?refresh/i.test(html)) continue; // エイリアス
  stat.pages++;
  const url = '/' + path.relative(PUB, path.dirname(f)).split(path.sep).join('/') + (path.dirname(f) === path.resolve(PUB) || path.relative(PUB, path.dirname(f)) === '' ? '' : '/');

  const faqLds = [];
  for (const m of html.matchAll(/<script type="?application\/ld\+json"?>([\s\S]*?)<\/script>/g)) {
    let j; try { j = JSON.parse(m[1]); } catch (e) { err(url, 'JSON-LD が JSON.parse できない: ' + e.message); continue; }
    if (j && j['@type'] === 'FAQPage') faqLds.push(j);
  }
  const body = html.replace(/<script[\s\S]*?<\/script>/g, ' ');
  const block = (body.match(/<section class="?faq-block"?[\s\S]*?<\/section>/) || [''])[0];
  const fac = (body.match(/<section class="?tg-hotel-faq"?[\s\S]*?<\/section>/) || [''])[0];
  const rest = body.replace(block, ' ').replace(fac, ' ');

  // 画面に出ている FAQ（質問 → 回答の一覧）
  const visible = [];
  const blockItems = [...block.matchAll(/<dt class="?faq-q"?>[\s\S]*?<span class="?faq-text"?>([\s\S]*?)<\/span><\/dt>\s*<dd class="?faq-a"?>[\s\S]*?<span class="?faq-text"?>([\s\S]*?)<\/span><\/dd>/g)];
  blockItems.forEach((m) => visible.push({ q: norm(text(m[1])), a: norm(text(m[2])), src: 'block' }));
  for (const m of fac.matchAll(/<p class="?tg-hotel-faq-q"?>([\s\S]*?)<\/p>\s*<p class="?tg-hotel-faq-a"?>([\s\S]*?)<\/p>/g)) visible.push({ q: norm(text(m[1])), a: norm(text(m[2])), src: 'facility' });
  // 本文の FAQ 節: FAQ 見出しの h2 から次の h2 まで
  let bodySec = '';
  const h2s = [...rest.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)];
  const hi = h2s.findIndex((m) => FAQ_H.test(text(m[1])));
  if (hi >= 0) bodySec = rest.slice(h2s[hi].index + h2s[hi][0].length, hi + 1 < h2s.length ? h2s[hi + 1].index : undefined);
  if (bodySec) {
    const art = [...bodySec.matchAll(/<div class="?lg-art-q"?>([\s\S]*?)<\/div>\s*<p class="?lg-art-a"?>([\s\S]*?)<\/p>/g)];
    if (art.length) art.forEach((m) => visible.push({ q: norm(text(m[1])), a: norm(text(m[2])), src: 'body' }));
    else {
      const qs = [...bodySec.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)];
      qs.forEach((m, i) => visible.push({ q: norm(text(m[1])), a: norm(text(bodySec.slice(m.index + m[0].length, i + 1 < qs.length ? qs[i + 1].index : undefined))), src: 'body' }));
    }
  }

  if (block) stat.blockPages++;
  if (fac) stat.facilityPages++;
  if (bodySec && !block) stat.bodyPages++;
  if (faqLds.length > 1) err(url, `FAQPage が ${faqLds.length} 個ある`);
  if (block && hi >= 0) err(url, '可視ブロックと本文の FAQ 節が両方ある（二重表示）');
  if ((html.match(/\sid="?faq"?[\s>]/g) || []).length > 1) err(url, 'id="faq" が2つ以上ある');
  if (block && !faqLds.length) err(url, '可視ブロックがあるのに FAQPage が無い');
  if (bodySec && !block && !faqLds.length) stat.bodyFaqWithoutLd++;

  const ldItems = faqLds.flatMap((j) => j.mainEntity || []);
  if (block && faqLds.length && ldItems.length !== blockItems.length) err(url, `可視ブロック ${blockItems.length} 問と FAQPage ${ldItems.length} 問の件数が違う`);
  if (faqLds.length) { stat.faqPages++; stat.faqQuestions += ldItems.length; }
  const names = [];
  for (const it of ldItems) {
    const q = String(it.name ?? ''), a = String(it.acceptedAnswer?.text ?? '');
    names.push(q);
    for (const [k, v] of [['質問', q], ['回答', a]]) {
      if (/^\s*".*"\s*$/s.test(v)) err(url, `${k}が "…" で囲まれている（二重エスケープ）: ${v.slice(0, 60)}`);
      if (/\\u[0-9a-fA-F]{4}|\\"/.test(v)) err(url, `${k}にエスケープ文字が残っている: ${v.slice(0, 60)}`);
    }
    const hit = visible.find((x) => x.q === norm(q));
    if (!hit) { err(url, '画面に無い質問が FAQPage にある: ' + q.slice(0, 60)); continue; }
    if (hit.a !== norm(a)) err(url, `回答が画面（${hit.src}）と一致しない: ` + q.slice(0, 60));
  }
  seenUrls.set(url, { block: !!block, names });
}

// 確認済み一覧（data/faq_jsonld.yaml）が古くなっていないか
const allow = readAllowlist(DATA);
for (const [url, v] of allow) {
  const p = seenUrls.get(url);
  if (!p) { err(url, `${DATA} にあるページが生成されていない`); continue; }
  if (p.block) err(url, `${DATA} にあるが、本文の FAQ 節が無く可視ブロックで表示されている（一覧から外す）`);
  if (v === 'all' && !p.names.length) err(url, `${DATA} で all だが FAQPage が出ていない`);
  if (Array.isArray(v)) for (const q of v) if (!p.names.includes(q)) err(url, `${DATA} の質問が FAQPage に出ていない（frontmatter の q と一致しない）: ${q.slice(0, 60)}`);
}

console.log(`FAQ 整合チェック: ${stat.pages} ページ／FAQPage ${stat.faqPages} ページ・${stat.faqQuestions} 問（可視ブロック ${stat.blockPages}・設備FAQ ${stat.facilityPages}・本文FAQ ${stat.bodyPages}〔うち FAQPage なし ${stat.bodyFaqWithoutLd}〕）／確認済み一覧 ${allow.size} ページ`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ stat, errors }, null, 1));
if (errors.length) { console.log(`  NG ${errors.length} 件`); errors.forEach((e) => console.log('   - ' + e)); process.exit(1); }
console.log('  ok   不整合 0 件');
