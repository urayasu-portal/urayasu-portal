/*
 * post-checks.mjs — 日次の posts 向けの追加検査（CI 専用。P0-B、2026-11-01）
 *
 * static/tools/post-rules.js（投稿ツールと CI の共通ルール）が見ていない項目だけをここに置く。
 * 同じ不備を二重に報告しないこと（既存ルールの一覧は scripts/validate/README.md）。
 * post-rules.js は static/ 配下で公開サイトにも出力されるため、CI 専用の検査はこちらに分けた。
 *
 * 既存記事を失敗させないための区別（legacy 例外）:
 *   新規記事向けの厳格なルールは、date（日本時間の日付）が STRICT_FROM 以降の記事だけに適用する。
 *   それより前の記事は対象外（一部は警告だけ）。date が読めない記事は新規扱い（date のエラーは post-rules.js が出す）。
 *   CI の validate ジョブは浅い clone（fetch-depth 1）で動くため「このコミットで変わった記事」を確実に取れない。
 *   そのため差分ではなく date で区別している（ワークフローを変えずに済む）。
 *
 * 期間に依存しない検査（先頭の空白・公開されない未来の date・期限切れ）は全記事に適用する。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = require(path.resolve(HERE, '../../static/tools/post-rules.js'));

/* 新規記事の厳格ルールの開始日（date の日本時間の日付）。記事化プロンプト側を変える場合もこの日付は動かさない */
export const STRICT_FROM = '2026-11-01';
/* 開催日と記事の date の食い違い（年・月の誤入力の疑い）の閾値 */
export const EVENT_PAST_DAYS = 30;
export const EVENT_FUTURE_DAYS = 365;
/* 重複・類似の閾値（タイトルは文字2-gram、本文は文字4-gram の Dice 係数。2026-11-01 の全 896 本で較正） */
export const BODY_DUP = 0.9;
export const BODY_SIMILAR = 0.6;
export const TITLE_SIMILAR = 0.85;
const MIN_BODY_CHARS = 200;

const pad2 = (n) => (n < 10 ? '0' : '') + n;
export const jstDay = (dp) => (dp && dp.ok ? dp.jst.y + '-' + pad2(dp.jst.m) + '-' + pad2(dp.jst.d) : '');
export const jstToday = (now) => new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
const fmtNow = (now) => new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
const dayDiff = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);

/** 新規記事の厳格ルールを適用するか（date が読めない記事は新規扱い） */
export function isStrict(dp, strictFrom = STRICT_FROM) {
  return !(dp && dp.ok) || jstDay(dp) >= strictFrom;
}

/* ───────────── 1. 先頭の空白 ─────────────
 * Hugo は --- の前の空行・空白を読み飛ばして公開する（0.167.0 で確認）が、post-rules.js は
 * 「1行目の --- がありません」とだけ報告し、ほかの検査がすべて止まる。原因が分かる文言にし、空白を除いて検査を続ける。 */
export function leadingWhitespace(text) {
  const src = String(text == null ? '' : text).replace(/^﻿/, '');
  const m = /^([ \t\r\n]*?)([ \t]*)---[ \t]*(\r?\n|$)/.exec(src);
  if (!m || (m[1] === '' && m[2] === '')) return { found: false };
  if (/[^\s]/.test(m[1])) return { found: false };
  const line = (m[1].match(/\n/g) || []).length + 1;
  const msg = line > 1
    ? '1行目より前に空白があります（frontmatter の --- が ' + line + ' 行目にあります）。ファイル先頭の空行・空白を削除して、1行目を --- にしてください'
    : '1行目より前に空白があります（1行目の --- の前に空白があります）。行頭の空白を削除して、1行目を --- だけにしてください';
  return { found: true, line, msg, stripped: src.slice(m[1].length + m[2].length) };
}

/* ───────────── 共通: 値の取り出し ───────────── */
const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const pick = (d, keys) => { for (const k of keys) if (d[k] !== undefined) return { key: k, value: d[k] }; return null; };

/** sources（name・url のリスト）を [{ name, url, line }] に分解する。post-rules.js はネストした項目を __raw で返す */
export function parseSources(v) {
  /* 文字列のリスト（  - "https://…"）は post-rules.js が配列で返す。テンプレートが .url を読めずビルドが止まる書き方 */
  if (Array.isArray(v)) return v.map((x) => ({ name: '', url: undefined, plain: String(x) }));
  const raw = v && typeof v === 'object' ? v.__raw || '' : '';
  const out = [];
  let cur = null;
  for (const line of raw.split('\n')) {
    const m = /^\s*-\s+(?:([A-Za-z_]\w*):\s*(.*))?$/.exec(line);
    if (m) { cur = { name: '', url: undefined }; out.push(cur); if (m[1]) setKv(cur, m[1], m[2]); continue; }
    const kv = /^\s+([A-Za-z_]\w*):\s*(.*)$/.exec(line);
    if (kv && cur) setKv(cur, kv[1], kv[2]);
  }
  return out;
}
function setKv(o, k, v) {
  let s = String(v || '').trim();
  if (/^".*"$/.test(s) || /^'.*'$/.test(s)) s = s.slice(1, -1);
  else s = s.replace(/\s+#.*$/, '');
  if (k === 'url') o.url = s; else if (k === 'name') o.name = s;
}

/* ───────────── アフィリエイト（広告）リンクの判定 ─────────────
 * 2026-11 時点でサイトが使っている ASP・提携先（data/・layouts/ で実際に使っているもの）＋主要 ASP */
const AFFILIATE_HOST_RE = /(^|\.)(a8\.net|valuecommerce\.com|valuecommerce\.ne\.jp|moshimo\.com|afl\.rakuten\.co\.jp|linksynergy\.com|tp\.media|tp\.st|emrld\.ltd|accesstrade\.net|felmat\.net|rentracks\.jp|amzn\.to)$/i;
const AFFILIATE_PARAM_RE = /[?&](a8mat|vc_url|Allianceid|aid|cid|tag|affiliate_id|afid)=/i;
const AFFILIATE_PARAM_HOST_RE = /(^|\.)(trip\.com|klook\.com|agoda\.com|amazon\.co\.jp|kkday\.com)$/i;
export function affiliateReason(url) {
  let u;
  try { u = new URL(url); } catch (e) { return ''; }
  if (AFFILIATE_HOST_RE.test(u.hostname)) return u.hostname;
  if (AFFILIATE_PARAM_HOST_RE.test(u.hostname) && AFFILIATE_PARAM_RE.test(u.search)) return u.hostname + ' の提携パラメータ（' + (AFFILIATE_PARAM_RE.exec(u.search)[1]) + '）';
  return '';
}

/* ───────────── 本文のリンク ───────────── */
const SITE_RE = /^https?:\/\/(www\.)?urayasu-portal\.com(?=\/|$)/i;
const STATIC_EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg|ico|pdf|mp4|webm|mp3|zip|csv|xlsx?|docx?|pptx?)$/i;
const PLACEHOLDER_RE = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\]|([a-z0-9-]+\.)?example\.(com|jp|org|net))(?=[:/?#]|$)|^file:/i;
export function extractLinks(body) {
  const out = [];
  const lineOf = (i) => body.slice(0, i).split('\n').length;
  for (const m of body.matchAll(/\b(href|src)\s*=\s*(["'])(.*?)\2/gi)) out.push({ kind: m[1].toLowerCase(), url: m[3].trim(), line: lineOf(m.index) });
  for (const m of body.matchAll(/!?\[[^\]\n]*\]\(([^)\n]*)\)/g)) {
    const u = m[1].trim().replace(/\s+(["']).*\1$/, '');
    out.push({ kind: m[0][0] === '!' ? 'src' : 'href', url: u, line: lineOf(m.index) });
  }
  return out;
}

/**
 * 記事1本の追加検査（重複・URL 衝突以外）。
 * ctx: { path, lang, fm, dp(post-rules の parseDate 結果), now, strict, siteUrls(Set|null), staticExists(fn), eventName }
 * 返り値: [{ rule, severity: 'error'|'warning', msg }]
 */
export function checkPost(ctx) {
  const out = [];
  const add = (rule, severity, msg) => out.push({ rule, severity, msg });
  const d = ctx.fm.data;
  const strict = ctx.strict;
  const now = ctx.now;
  const today = jstToday(now);
  const postDay = jstDay(ctx.dp);

  /* ── 公開されない date（全記事。buildFuture・buildExpired なし） ──
   * CI の時刻＝push 直後。date（publishDate があればそちら）が今より未来で、その日付（日本時間）が今日以前なら
   * 「当日の記事を未来の時刻で書いた」事故（旧 22:00 ルール）とみなしてエラー。翌日以降の日付は予約投稿として従来どおり通知だけ。
   * push・ローカル実行以外（pull_request・schedule・workflow_dispatch）は、公開される時刻と検証時刻が一致しないため警告に下げる。 */
  const pub = pick(d, ['publishDate', 'publishdate', 'pubdate', 'pubDate']);
  const pubDp = pub && typeof pub.value === 'string' ? R.parseDate(pub.value) : null;
  const eff = pubDp && pubDp.ok ? { dp: pubDp, key: pub.key } : (ctx.dp && ctx.dp.ok ? { dp: ctx.dp, key: 'date' } : null);
  if (eff && eff.dp.epochMs > now && jstDay(eff.dp) <= today) {
    const pushLike = !ctx.eventName || ctx.eventName === 'push';
    add('DATE_NOT_PUBLISHED', pushLike ? 'error' : 'warning',
      eff.key + ' が公開時刻より未来です（buildFuture なしのため公開されません）。' + eff.key + ' は日本時間 ' + R.fmtJst(eff.dp) + '、検証時刻は ' + fmtNow(now) +
      '。このビルドでは公開されず、次の再ビルド（schedule は不安定）まで非公開のままです。当日の記事は ' + eff.key + ' を push より前の時刻にしてください（予約投稿は翌日以降の日付で）' +
      (pushLike ? '' : '（push 以外の実行のため警告にしています）'));
  }
  if (pub && !(pubDp && pubDp.ok)) add('PUBLISHDATE_FORMAT', 'error', pub.key + ' の形式が正しくありません（「' + String(pub.value) + '」）。posts では publishDate は使わず、date だけを書いてください');
  const exp = pick(d, ['expiryDate', 'expirydate', 'unpublishdate', 'unpublishDate']);
  if (exp) {
    const ep = typeof exp.value === 'string' ? R.parseDate(exp.value) : { ok: false };
    if (!ep.ok) add('EXPIRYDATE_FORMAT', 'error', exp.key + ' の形式が正しくありません（「' + String(exp.value) + '」）。期限で非公開にしない場合は項目ごと削除してください');
    else if (ep.epochMs <= now) add('EXPIRYDATE_PASSED', strict ? 'error' : 'warning', exp.key + '（日本時間 ' + R.fmtJst(ep) + '）を過ぎているため、この記事は公開されません（buildExpired なし）。意図しない場合は ' + exp.key + ' を削除してください');
  }

  if (!strict) {
    /* 既存記事（STRICT_FROM より前）は、本文の内部リンク切れだけを警告する（ガイドの URL 変更で後から切れることがあるため） */
    linkChecks(ctx, (rule, sev, msg) => { if (rule === 'LINK_INTERNAL_BROKEN') add(rule, 'warning', msg); });
    return out;
  }

  /* ── 必須項目（新規記事）。title・date・slug・categories・draft は post-rules.js が検査済み ── */
  if (isBlank(d.description) || typeof d.description !== 'string') add('DESCRIPTION_MISSING', 'error', 'description がありません（検索結果・SNS の説明文になります）。記事の要約を1〜2文で書いてください');
  if (ctx.lang === 'ja') {
    const tags = d.tags;
    if (tags === undefined || isBlank(tags) || (Array.isArray(tags) && tags.length === 0)) add('TAGS_MISSING', 'error', 'tags がありません。data/guide_map.yaml のタグに該当する場合はそのタグも付けてください（ガイドカードが自動表示されます）');
    else if (!Array.isArray(tags)) add('TAGS_FORMAT', 'error', 'tags はリスト（  - "浦安市" の形式）で書いてください（「' + String(tags) + '」）');
  }

  /* ── lastmod（新規記事） ── */
  if (d.lastmod !== undefined && d.lastmod !== '') {
    const lp = typeof d.lastmod === 'string' ? R.parseDate(d.lastmod) : { ok: false };
    if (!lp.ok) add('LASTMOD_FORMAT', 'error', 'lastmod の形式が正しくありません（「' + String(d.lastmod) + '」）。例：lastmod: 2026-11-01T18:30:00+09:00');
    else {
      const lday = jstDay(lp);
      if (postDay && lday < postDay) add('LASTMOD_BEFORE_DATE', 'error', 'lastmod（' + lday + '）が date（' + postDay + '）より前です。更新した日（作業当日）にしてください。date は初回公開日のまま変えません');
      if (lday > today) add('LASTMOD_FUTURE', 'warning', 'lastmod（' + lday + '）が今日（' + today + '、日本時間）より先です。更新した日（作業当日）にしてください');
    }
  }

  /* ── 開催日と記事の date の食い違い（年・月の誤入力の疑い。警告） ── */
  const evVals = [];
  if (typeof d.eventDate === 'string') evVals.push(d.eventDate);
  else if (Array.isArray(d.eventDate)) evVals.push(...d.eventDate);
  if (Array.isArray(d.eventDates)) evVals.push(...d.eventDates);
  const ymd = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) && R.isRealYmd(s) ? s : '');
  const starts = [], ends = [];
  evVals.forEach((x) => { const p = String(x).split('/'); const a = ymd(p[0]), b = ymd(p[p.length - 1]); if (a) starts.push(a); if (b) ends.push(b); });
  if (d.eventKind !== undefined && d.eventDate === undefined && d.eventDates === undefined) add('EVENTKIND_WITHOUT_DATE', 'warning', 'eventKind があるのに eventDate・eventDates がありません（イベントカレンダーに載りません）。開催日を書くか、eventKind を削除してください');
  if (postDay && ends.length && d.eventOngoing !== true) {
    const lastEnd = ends.sort().pop();
    if (dayDiff(lastEnd, postDay) < -EVENT_PAST_DAYS) add('EVENT_ENDED_BEFORE_POST', 'warning', '開催日の最終日（' + lastEnd + '）が記事の date（' + postDay + '）より' + EVENT_PAST_DAYS + '日以上前です。年・月の誤入力ではないか確認してください');
  }
  if (postDay && starts.length) {
    const firstStart = starts.sort()[0];
    if (dayDiff(firstStart, postDay) > EVENT_FUTURE_DAYS) add('EVENT_FAR_AFTER_POST', 'warning', '開催日（' + firstStart + '）が記事の date（' + postDay + '）より1年以上先です。年の誤入力ではないか確認してください');
  }

  /* ── 出典（sources）と広告リンク ── */
  if (d.sources !== undefined) {
    const srcs = parseSources(d.sources);
    const fmtMsg = 'sources の書き方が正しくありません。1件ごとに「  - name: "資料名"」「    url: "https://…"」の組で書いてください（文字列だけの行はサイトのビルドが止まります）';
    if ((!srcs.length && !isBlank(d.sources) && !(Array.isArray(d.sources) && !d.sources.length)) || srcs.some((s) => s.plain)) add('SOURCES_FORMAT', 'error', fmtMsg);
    srcs.forEach((s, i) => {
      if (s.plain) return;
      const at = 'sources の' + (i + 1) + '番目' + (s.name ? '（' + s.name.slice(0, 30) + '）' : '');
      /* url の無い資料（紙の広報誌など）は name だけで表示される（layouts/partials/source-info.html）ので可 */
      if (isBlank(s.url)) { if (isBlank(s.name)) add('SOURCES_FORMAT', 'error', at + 'に name も url もありません。' + fmtMsg.replace(/^sources の書き方が正しくありません。/, '')); }
      else if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(s.url)) add('SOURCES_URL_INVALID', 'error', at + 'の url「' + s.url + '」が http(s):// で始まる URL ではありません');
      else {
        const why = affiliateReason(s.url);
        if (why) add('SOURCES_AFFILIATE', 'error', at + 'の url が広告（アフィリエイト）リンクです（' + why + '）。出典には一次情報の URL をそのまま書いてください。広告リンクは本文に PR 表記つきで置きます');
      }
    });
  }
  linkChecks(ctx, add);
  return out;
}

/** 本文のリンク検査。add(rule, severity, msg) */
function linkChecks(ctx, add) {
  const links = extractLinks(ctx.fm.body || '');
  const seen = new Set();
  for (const l of links) {
    const u = l.url;
    const at = (l.line + (ctx.bodyLineOffset || 0)) + ' 行目の' + (l.kind === 'src' ? '画像' : 'リンク');
    if (/\{\{|\}\}/.test(u)) continue; /* ref・relref などのショートコードは Hugo が検査する */
    if (u === '' || u === '#') { add('LINK_EMPTY', 'error', at + 'の URL が空です（「' + (u || '空') + '」）。リンク先を書くか、リンクを外してください'); continue; }
    if (PLACEHOLDER_RE.test(u)) { add('LINK_PLACEHOLDER', 'error', at + 'が仮の URL です（「' + u + '」）。実際のリンク先にしてください'); continue; }
    if (/^https?:\/\//i.test(u) && !SITE_RE.test(u)) {
      if (l.kind === 'href') { const why = affiliateReason(u); if (why && !seen.has('aff')) { seen.add('aff'); add('AFFILIATE_LINK_IN_POST', 'warning', at + 'が広告（アフィリエイト）リンクです（' + why + '）。posts に広告を置く場合は PR 表記を付け、出典（sources）とは分けてください'); } }
      continue;
    }
    let p = u.replace(SITE_RE, '');
    if (!p.startsWith('/') || p.startsWith('//')) continue; /* 相対パス・mailto・tel・外部は対象外 */
    p = p.split('#')[0].split('?')[0];
    if (!p) continue;
    if (/^\/((en|zh|zh-tw|ko)\/)?(tags|categories)\//.test(p)) continue; /* タクソノミーは hugo list に出ないので対象外 */
    let dec = p;
    try { dec = decodeURI(p); } catch (e) { /* そのまま */ }
    if (/\.[a-z0-9]{2,5}$/i.test(dec) && !/\.html?$/i.test(dec)) {
      /* 画像・PDF・動画など static/ に置くファイルだけを確かめる（index.xml・sitemap.xml などの生成物は対象外） */
      if (STATIC_EXT_RE.test(dec) && ctx.staticExists && !ctx.staticExists(dec)) add('LINK_INTERNAL_BROKEN', 'error', at + '「' + u + '」のファイルがありません（static/ に無いため 404 になります）');
      continue;
    }
    if (ctx.siteUrls && !ctx.siteUrls.has(R.normUrl(dec))) add('LINK_INTERNAL_BROKEN', 'error', at + '「' + u + '」の行き先がありません（サイトのどのページ・aliases にも無いため 404 になります）');
  }
}

/* ───────────── 6. 重複・類似の記事 ───────────── */
const normTitle = (s) => String(s || '').normalize('NFKC').replace(/\s+/g, '');
const normForGrams = (s) => String(s || '').normalize('NFKC').replace(/<[^>]+>/g, '').replace(/\{\{[^}]*\}\}/g, '').replace(/[\s「」『』【】（）()、。！!？?・：:，,"'\-〜~]/g, '');
const grams = (s, n) => { const set = new Set(); for (let i = 0; i + n <= s.length; i++) set.add(s.slice(i, i + n)); return set; };
export function dice(a, b) {
  if (!a.size || !b.size) return 0;
  const [x, y] = a.size < b.size ? [a, b] : [b, a];
  let n = 0;
  for (const g of x) if (y.has(g)) n++;
  return (2 * n) / (a.size + b.size);
}
/** 重複判定用の要約。posts: [{ path, lang, title, body, epoch }] */
export function dupProfile(p) {
  const body = normForGrams(p.body);
  return { ...p, tExact: normTitle(p.title), tGrams: grams(normForGrams(String(p.title || '').replace(/^\s*【[^】]*】/, '')), 2), bGrams: body.length >= MIN_BODY_CHARS ? grams(body, 4) : new Set() };
}
/**
 * 新規記事（strict）を、同じ言語の他の全記事と比べる。新規記事どうしは後から公開した方（date→パス順）だけを指摘する。
 * 返り値: [{ rule, severity, path, msg }]
 */
export function findDuplicates(profiles) {
  const out = [];
  const later = (a, b) => (a.epoch !== b.epoch ? a.epoch > b.epoch : a.path > b.path);
  for (const a of profiles) {
    if (!a.strict) continue;
    let best = null;
    for (const b of profiles) {
      if (b === a || b.lang !== a.lang) continue;
      if (b.strict && !later(a, b)) continue;
      const exact = a.tExact && a.tExact === b.tExact;
      const bd = dice(a.bGrams, b.bGrams);
      const td = dice(a.tGrams, b.tGrams);
      let hit = null;
      if (exact) hit = { rule: 'DUPLICATE_TITLE', severity: 'error', score: 2, msg: 'タイトルが既存記事（' + b.path + '）と同じです。同じ記事の重複投稿ではないか確認してください。続報なら既存記事に追記するか、タイトルと slug を変えてください' };
      else if (bd >= BODY_DUP) hit = { rule: 'DUPLICATE_BODY', severity: 'error', score: 1 + bd, msg: '本文が既存記事（' + b.path + '）とほぼ同じです（類似度 ' + bd.toFixed(2) + '）。重複投稿・別記事の誤混入ではないか確認してください' };
      else if (bd >= BODY_SIMILAR || td >= TITLE_SIMILAR) hit = { rule: 'SIMILAR_POST', severity: 'warning', score: Math.max(bd, td), msg: '既存記事（' + b.path + '）と' + (bd >= BODY_SIMILAR ? '本文' : 'タイトル') + 'がよく似ています（類似度 ' + Math.max(bd, td).toFixed(2) + '）。同じ話題なら既存記事への追記か、続報として slug を分けてください' };
      if (hit && (!best || hit.score > best.score)) best = hit;
    }
    if (best) out.push({ rule: best.rule, severity: best.severity, path: a.path, msg: best.msg });
  }
  return out;
}

/* ───────────── 2. URL 衝突の説明と slug の提案 ───────────── */
/**
 * 衝突1件について、後から加わったファイルごとに具体的な文言を作る。
 * c: { url, files, via:['path:url'|'path:alias'] }、info: path → { data, dp, lang }、knownFiles: Set|undefined、taken: Set（使用中 URL）
 * 返り値: [{ path, msg, suggestion }]
 */
export function describeCollision(c, info, knownFiles, taken) {
  const viaOf = (f) => (c.via.find((v) => v.startsWith(f + ':')) || ':url').split(':').pop();
  const epoch = (f) => (info[f] && info[f].dp && info[f].dp.ok ? info[f].dp.epochMs : Infinity);
  let existing;
  if (knownFiles && knownFiles.size) existing = c.files.filter((f) => knownFiles.has(f));
  else {
    const sorted = [...c.files].sort((a, b) => epoch(a) - epoch(b) || a.localeCompare(b));
    existing = [sorted[0]];
  }
  if (!existing.length) existing = [c.files[0]];
  const added = c.files.filter((f) => !existing.includes(f));
  const ex = existing[0];
  const exVia = viaOf(ex) === 'alias' ? 'の aliases' : '';
  return added.map((f) => {
    const it = info[f] || { data: {}, lang: 'ja' };
    const d = it.data || {};
    const via = viaOf(f);
    const what = via === 'alias' ? 'aliases の「' + c.url + '」' : typeof d.url === 'string' && d.url ? 'url' : typeof d.slug === 'string' && d.slug ? 'slug' : 'ファイル名から決まる URL';
    const suggestion = suggestSlug(f, it, taken);
    let msg = what + (/[A-Za-z]$/.test(what) ? ' が' : 'が') + '既存記事（' + ex + '）' + exVia + 'と重複しています（URL: ' + c.url + '）。同じ URL に2つのページが出力され、どちらかが表示されなくなります。';
    if (via === 'alias') msg += 'aliases から「' + c.url + '」を外してください';
    else msg += '後から追加したこの記事の slug を変えてください' + (suggestion ? '（続報なら例：slug: "' + suggestion + '"）' : '');
    return { path: f, msg, suggestion };
  });
}
/** 続報向けの slug 案: <元の slug>-<YYYYMMDD>（使用中なら -2, -3 …） */
export function suggestSlug(file, it, taken) {
  const d = (it && it.data) || {};
  let base = typeof d.slug === 'string' && d.slug ? d.slug : typeof d.url === 'string' && d.url ? d.url.replace(/\/+$/, '').split('/').pop() : R.splitFileName(file).stem;
  base = String(base).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!base) base = 'post';
  const ymd = jstDay(it && it.dp).replace(/-/g, '');
  const stem = ymd ? base.replace(new RegExp('-' + ymd + '(-\\d+)?$'), '') + '-' + ymd : base;
  const prefix = R.langPrefix(it && it.lang);
  for (let n = 1; n < 50; n++) {
    const cand = n === 1 ? stem : stem + '-' + n;
    if (cand === base) continue;
    if (!taken || !taken.has(R.normUrl(prefix + '/posts/' + cand + '/'))) return cand;
  }
  return '';
}

/* ───────────── static ファイルの存在確認 ───────────── */
export function staticChecker(root) {
  const cache = new Map();
  return (p) => {
    if (cache.has(p)) return cache.get(p);
    /* posts は単一ファイル（ページバンドルではない）なので、直接リンクできるのは static/ のファイルだけ */
    const ok = fs.existsSync(path.join(root, 'static', p.replace(/^\//, '')));
    cache.set(p, ok);
    return ok;
  };
}
