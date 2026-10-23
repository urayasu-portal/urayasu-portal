#!/usr/bin/env node
/*
 * FAQ の可視表示と FAQPage 構造化データのテスト（工程6 Phase 6B-1A）。リポジトリ直下で実行:
 *   node scripts/validate/test/faq-hugo.mjs            （hugo が PATH にある場合）
 *   HUGO=/path/to/hugo node scripts/validate/test/faq-hugo.mjs
 * 一時ディレクトリに ja・en の最小 Hugo サイトを作り、リポジトリの faq-items.html・faq-visible.html・faq-jsonld.html・
 * hotel-facility-faq.html をそのまま使ってビルドし、次を確かめる:
 *   - 引用符・& ・< > ・バックスラッシュ・改行・日本語/中国語/韓国語を含む値が、JSON-LD で元の文字列のまま読める（二重エスケープなし）
 *   - JSON-LD の回答が画面の回答（Markdown を描画したテキスト）と一致する
 *   - 本文に FAQ 節があるページは、data/faq_jsonld.yaml の確認済み一覧にある質問だけを出す（無ければ FAQPage なし）
 *   - faq: が無いページには何も出ない／FAQPage は1ページに1つ
 *   - en の設備 FAQ は "…" で囲まれない・& が文字として残らない。frontmatter faq: があれば設備 FAQ の JSON-LD は出さない
 * 依存ライブラリなし。失敗があれば終了コード 1。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const HUGO = process.env.HUGO || 'hugo';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'faq-'));
const w = (rel, t) => { const p = path.join(DIR, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); };

w('hugo.toml', [
  'baseURL = "https://example.test/"', 'defaultContentLanguage = "ja"', 'defaultContentLanguageInSubdir = false',
  'disableKinds = ["taxonomy", "term", "RSS", "sitemap", "robotsTXT", "404", "home", "section"]',
  '[languages.ja]', 'weight = 1', '[languages.en]', 'weight = 2', '',
].join('\n'));
for (const f of ['faq-items.html', 'faq-visible.html', 'faq-jsonld.html', 'hotel-facility-faq.html']) w('layouts/partials/' + f, fs.readFileSync(path.join(ROOT, 'layouts/partials', f), 'utf8'));
w('layouts/_default/baseof.html', '<html><head>{{ partial "faq-jsonld.html" . }}</head><body>{{ block "main" . }}{{ end }}</body></html>\n');
w('layouts/_default/single.html', '{{- define "main" }}<main>{{ .Content }}</main>{{ partial "faq-visible.html" . }}{{ partial "hotel-facility-faq.html" . }}{{ end }}\n');

// テスト用の値（YAML の二重引用符文字列として書く）
const TRICKY_Q = '"引用符" & <タグ> \\ 와 中文 질문？';
const yq = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const fm = (title, faq, extra = '') => `---\ntitle: ${yq(title)}\n${extra}${faq ? 'faq:\n' + faq.map((x) => `  - q: ${yq(x.q)}\n    a: ${yq(x.a)}\n`).join('') : ''}---\n`;
const BASIC = [
  { q: TRICKY_Q, a: '**太字**と[リンク](/x/)、"引用" & バックスラッシュ \\ を含む。\n2行目の文。' },
  { q: '普通の質問ですか？', a: 'はい。普通の回答です。' },
];
w('content/block.md', fm('可視ブロック', BASIC) + '本文です。\n');
w('content/nofaq.md', fm('FAQ なし', null) + '本文です。\n');
const BODY_FAQ = '\n## よくある質問\n\n### 本文の質問A？\n\n本文の回答A。\n\n### 本文の質問B？\n\n本文の回答B。\n';
const BFAQ = [{ q: '本文の質問A？', a: '本文の回答A。' }, { q: '本文の質問B？', a: '本文の回答B。' }];
w('content/body-unlisted.md', fm('本文FAQ・一覧なし', BFAQ) + BODY_FAQ);
w('content/body-all.md', fm('本文FAQ・all', BFAQ) + BODY_FAQ);
w('content/body-some.md', fm('本文FAQ・一部', BFAQ) + BODY_FAQ);
w('data/faq_jsonld.yaml', 'body_faq_verified:\n  /body-all/: all\n  /body-some/:\n    - "本文の質問B？"\n');
// en の設備 FAQ（hotels_map の slug＝ファイル名）
const HOTEL = 'SPA & HOTEL "Test" \\ ホテル';
w('data/hotels_map.yaml', `hotels:\n  - slug: "fac-only"\n    name_en: ${yq(HOTEL)}\n    flags: [laundry, shuttle]\n  - slug: "fac-with-fm"\n    name_en: "Plain Hotel"\n    flags: [pool]\n`);
w('content/fac-only.en.md', fm('Facility only', null) + 'Body.\n');
w('content/fac-with-fm.en.md', fm('Facility with faq', [{ q: 'Frontmatter question?', a: 'Frontmatter answer.' }]) + 'Body.\n');

const r = spawnSync(HUGO, ['--source', DIR, '--destination', path.join(DIR, 'public'), '--quiet'], { encoding: 'utf8' });
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };
if (r.status !== 0) { console.log('  FAIL Hugo のビルドが失敗しました\n' + (r.stderr || r.stdout || r.error)); process.exit(1); }

const page = (p) => fs.readFileSync(path.join(DIR, 'public', p, 'index.html'), 'utf8');
const lds = (html) => [...html.matchAll(/<script type="?application\/ld\+json"?>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const faqOf = (html) => lds(html).filter((j) => j['@type'] === 'FAQPage');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', nbsp: ' ', hellip: '…' };
const plain = (h) => h.replace(/<[^>]+>/g, '').replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] ?? m)).replace(/\s+/g, ' ').trim();

// 1. 可視ブロック（mode block）
{
  const h = page('block'), f = faqOf(h);
  ok(f.length === 1, '可視ブロックのページ: FAQPage が1つ');
  const items = f[0]?.mainEntity || [];
  ok(items.length === 2, '可視ブロックのページ: 2問とも出る');
  ok(items[0]?.name === TRICKY_Q, '質問の引用符・&・<>・\\・韓国語・中国語が元の文字列のまま（二重エスケープなし）');
  const vis = [...h.matchAll(/<dd class="?faq-a"?>[\s\S]*?<span class="?faq-text"?>([\s\S]*?)<\/span><\/dd>/g)].map((m) => plain(m[1]));
  ok(items.every((it, i) => it.acceptedAnswer.text.replace(/\s+/g, ' ').trim() === vis[i]), 'JSON-LD の回答が画面の回答（Markdown 描画後のテキスト）と一致');
  ok(!/\*\*|\]\(/.test(items[0]?.acceptedAnswer.text || ''), '回答に Markdown 記法が残らない');
  const raw = h.match(/<script type="?application\/ld\+json"?>([\s\S]*?)<\/script>/)[1];
  ok(!/<\/script/i.test(raw) && !/<タグ>/.test(raw), 'script 内で < > がエスケープされている（</script> で閉じられない）');
  ok((h.match(/class="?faq-item"?/g) || []).length === 2, '可視ブロックに2問');
}
// 2. FAQ なし
{ const h = page('nofaq'); ok(!faqOf(h).length && !/faq-block/.test(h), 'faq: が無いページ: 可視ブロックも FAQPage も出ない'); }
// 3. 本文 FAQ（mode body）
{
  const h = page('body-unlisted');
  ok(!/faq-block/.test(h), '本文FAQ・一覧なし: 可視ブロックを出さない（二重表示しない）');
  ok(!faqOf(h).length, '本文FAQ・一覧なし: FAQPage を出さない（確認できない質問は出さない）');
  const a = faqOf(page('body-all'));
  ok(a.length === 1 && a[0].mainEntity.length === 2, '本文FAQ・all: 2問とも出る');
  const s = faqOf(page('body-some'));
  ok(s.length === 1 && s[0].mainEntity.length === 1 && s[0].mainEntity[0].name === '本文の質問B？', '本文FAQ・一部: 一覧の質問だけ出る');
  ok(!/faq-block/.test(page('body-all')), '本文FAQ・all: 可視ブロックは出さない');
}
// 4. en 設備 FAQ
{
  const h = page('en/fac-only'), f = faqOf(h);
  ok(f.length === 1, '設備FAQ: FAQPage が1つ');
  const items = f[0]?.mainEntity || [];
  ok(items[0]?.name === `Does ${HOTEL} have a coin laundry?`, '設備FAQ: 質問がホテル名（引用符・&・\\ 入り）を含めて元の文字列のまま');
  ok(items.every((it) => !/^"|"$/.test(it.name) && !/\\u00|\\"/.test(it.name + it.acceptedAnswer.text)), '設備FAQ: "…" で囲まれず、エスケープ文字が残らない');
  const vis = [...h.matchAll(/<p class="?tg-hotel-faq-a"?>([\s\S]*?)<\/p>/g)].map((m) => plain(m[1]));
  ok(items.length === vis.length && items.every((it, i) => it.acceptedAnswer.text === vis[i]), '設備FAQ: JSON-LD の回答が画面の回答と一致');
  const g = faqOf(page('en/fac-with-fm'));
  ok(g.length === 1 && g[0].mainEntity[0].name === 'Frontmatter question?', 'frontmatter faq: がある en ホテル: FAQPage は frontmatter の1つだけ（設備FAQ の JSON-LD は出さない）');
}

console.log(`\n${pass} passed, ${fail} failed`);
fs.rmSync(DIR, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
