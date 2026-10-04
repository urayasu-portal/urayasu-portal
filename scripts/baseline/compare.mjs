#!/usr/bin/env node
/*
 * compare.mjs — snapshot.mjs の出力2つを比較し、増えた行・消えた行を表示する
 *   node scripts/baseline/compare.mjs <改修前> <改修後> [--max 20]
 * 終了コード: 0 = 差分なし / 1 = 差分あり
 * build-warnings.txt と summary.json の generatedAt は比較対象から外す（環境依存のため。警告は件数だけ見る）。
 */
import fs from 'node:fs';
import path from 'node:path';

const [A, B] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const mi = process.argv.indexOf('--max');
const MAX = mi > 0 ? +process.argv[mi + 1] : 20;
if (!A || !B) { console.error('usage: compare.mjs <before> <after>'); process.exit(2); }
const FILES = ['content-inventory.tsv', 'pages.tsv', 'aliases.tsv', 'sitemap-urls.txt', 'affiliate-links.tsv', 'duplicate-paths.txt', 'build-warnings.txt'];
const read = (d, f) => (fs.existsSync(path.join(d, f)) ? fs.readFileSync(path.join(d, f), 'utf8').split('\n').filter(Boolean) : null);
let changed = false;
for (const f of FILES) {
  const a = read(A, f), b = read(B, f);
  if (!a || !b) { console.log(`- ${f}: 比較不可（${!a ? '改修前' : '改修後'}に無い）`); continue; }
  const sa = new Set(a), sb = new Set(b);
  const removed = a.filter((x) => !sb.has(x)), added = b.filter((x) => !sa.has(x));
  if (f === 'build-warnings.txt') { console.log(`- ${f}: ${a.length} 行 → ${b.length} 行`); removed.forEach((x) => console.log('    − ' + x.slice(0, 160))); added.forEach((x) => console.log('    ＋ ' + x.slice(0, 160))); continue; }
  const same = !removed.length && !added.length;
  if (!same) changed = true;
  console.log(`- ${f}: ${a.length} 行 → ${b.length} 行 ${same ? '（差分なし）' : `（−${removed.length} / ＋${added.length}）`}`);
  removed.slice(0, MAX).forEach((x) => console.log('    − ' + x.slice(0, 200)));
  added.slice(0, MAX).forEach((x) => console.log('    ＋ ' + x.slice(0, 200)));
  if (removed.length > MAX || added.length > MAX) console.log(`    …（以下省略。--max で件数を変更）`);
}
process.exit(changed ? 1 : 0);
