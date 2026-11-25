#!/usr/bin/env node
/*
 * 冒頭写真（.post-cover の img）の属性チェック（工程7C-B1）。ビルド後の public に対して実行:
 *   node scripts/validate/hero-img-audit.mjs --public public
 * - 冒頭写真は loading="eager" fetchpriority="high"。サイト内の画像（/ で始まる）は実寸の width・height と style="height:auto" を持つ
 * - width・height は static/ の画像の実寸と一致する（PNG・JPEG・WebP・GIF のヘッダーを読んで比べる）
 * - fetchpriority="high" は1ページに1枚まで
 * 依存ライブラリなし。不整合があれば終了コード 1。
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const PUB = args[args.indexOf('--public') + 1] || 'public';
const STATIC = 'static';

// 画像ファイルのヘッダーから幅・高さを読む（読めなければ null）
function dims(file) {
  let b;
  try { b = fs.readFileSync(file); } catch { return null; }
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)]; // PNG
  if (b.length > 10 && b.toString('ascii', 0, 3) === 'GIF') return [b.readUInt16LE(6), b.readUInt16LE(8)];
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const k = b.toString('ascii', 12, 16);
    if (k === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (k === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (k === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
    return null;
  }
  if (b[0] === 0xff && b[1] === 0xd8) { // JPEG: SOF0〜SOF15（DHT・JPG・DAC を除く）を探す
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.html') ? [path.join(d, e.name)] : []);
const attr = (tag, name) => { const m = new RegExp('\\s' + name + '=(?:"([^"]*)"|([^\\s>]+))').exec(tag); return m ? (m[1] ?? m[2]) : null; };
const errs = [];
let pages = 0, heroes = 0, sized = 0;
for (const f of walk(PUB)) {
  const html = fs.readFileSync(f, 'utf8');
  const rel = path.relative(PUB, f).split(path.sep).join('/');
  const high = (html.match(/fetchpriority="?high/g) || []).length;
  if (high > 1) errs.push(rel + ': fetchpriority="high" が ' + high + ' 枚');
  const tags = [...html.matchAll(/<div class="?post-cover"?>\s*(<img\b[^>]*>)/g)].map((m) => m[1]);
  if (!tags.length) continue;
  pages++;
  for (const t of tags) {
    heroes++;
    const src = attr(t, 'src') || '';
    if (attr(t, 'loading') !== 'eager' || attr(t, 'fetchpriority') !== 'high') errs.push(rel + ': loading・fetchpriority が eager・high でない ' + src);
    if (!src.startsWith('/') || src.startsWith('//')) continue;
    const real = dims(path.join(STATIC, decodeURIComponent(src)));
    const w = attr(t, 'width'), h = attr(t, 'height');
    if (!real) { if (w || h) errs.push(rel + ': 実寸を読めない画像に width・height がある ' + src); continue; }
    if (String(real[0]) !== w || String(real[1]) !== h) { errs.push(rel + ': width・height が実寸と違う ' + src + ' 属性 ' + w + '×' + h + ' 実寸 ' + real.join('×')); continue; }
    if (!/style="?height:auto/.test(t)) errs.push(rel + ': style="height:auto" が無い ' + src);
    sized++;
  }
}
console.log('冒頭写真チェック: ' + pages + ' ページ／' + heroes + ' 枚（実寸の width・height あり ' + sized + ' 枚）');
if (errs.length) { console.log('  FAIL ' + errs.length + ' 件\n       ' + errs.slice(0, 30).join('\n       ')); process.exit(1); }
console.log('  ok   不整合 0 件');
