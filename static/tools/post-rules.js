/*
 * post-rules.js — posts の frontmatter 検証ルール（単一ソース）
 *
 * 投稿ツール（static/tools/post-tool.html、ブラウザ）と CI（scripts/validate/validate-content.mjs、Node）の
 * 両方から読み込む。ルールを変えるときはこのファイルだけを直し、
 * scripts/validate/test/run-tests.mjs でテストを通すこと。
 *
 * 外部ライブラリに依存しない（ブラウザ・Node・ローカル環境のどれでも同じ結果になるように）。
 * そのため YAML は「posts の frontmatter で実際に使っている範囲」だけを解釈する簡易パーサーで読む。
 * 完全な YAML 構文チェックは Hugo のビルドが担う（構文エラーはビルド失敗になる）。
 *
 * 用語:
 *   error   … 投稿をブロックする／CI で新規の不備として報告する
 *   warning … 確認を促す。投稿は続行できる
 *   isNew   … 新規記事か（既存記事の更新では slug 必須などを課さない＝後方互換）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PostRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ALLOWED_CATEGORIES = ['開店・閉店', 'ニュース', 'イベント', 'グルメ・カフェ', 'スポーツ', '子育て・教育', 'お知らせ'];
  var SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var LANGS = ['en', 'zh', 'zh-tw', 'ko'];
  var JST_OFFSET_MIN = 9 * 60;
  /* 未来日時がこれより先なら「誤入力の可能性」を強めに警告する */
  var FAR_FUTURE_DAYS = 30;

  /* ───────────── frontmatter の解析 ───────────── */

  function normalizeText(text) {
    return String(text == null ? '' : text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  }

  function unquote(v, lineNo, errs) {
    var s = v.trim();
    if (s === '') return '';
    if (s[0] === '"') {
      var out = '', i = 1, closed = false;
      for (; i < s.length; i++) {
        var c = s[i];
        if (c === '\\' && i + 1 < s.length) {
          var n = s[++i];
          out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
        } else if (c === '"') { closed = true; i++; break; }
        else out += c;
      }
      if (!closed) { errs.push({ line: lineNo, msg: 'ダブルクォートが閉じていません' }); return out; }
      var rest = s.slice(i).trim();
      if (rest && rest[0] !== '#') errs.push({ line: lineNo, msg: 'クォートの後ろに余分な文字があります：' + rest });
      return out;
    }
    if (s[0] === "'") {
      var o = '', j = 1, cl = false;
      for (; j < s.length; j++) {
        if (s[j] === "'") {
          if (s[j + 1] === "'") { o += "'"; j++; continue; }
          cl = true; j++; break;
        }
        o += s[j];
      }
      if (!cl) { errs.push({ line: lineNo, msg: 'シングルクォートが閉じていません' }); return o; }
      var r = s.slice(j).trim();
      if (r && r[0] !== '#') errs.push({ line: lineNo, msg: 'クォートの後ろに余分な文字があります：' + r });
      return o;
    }
    /* プレーンスカラー。 " #" 以降はコメント */
    var hash = s.search(/\s#/);
    if (hash >= 0) s = s.slice(0, hash).trim();
    return s;
  }

  function scalar(v, lineNo, errs) {
    var t = v.trim();
    if (t === 'true') return true;
    if (t === 'false') return false;
    return unquote(t, lineNo, errs);
  }

  function splitInline(inner) {
    var items = [], cur = '', q = null;
    for (var i = 0; i < inner.length; i++) {
      var c = inner[i];
      if (q) {
        cur += c;
        if (c === '\\' && q === '"' && i + 1 < inner.length) { cur += inner[++i]; continue; }
        if (c === q) q = null;
      } else if (c === '"' || c === "'") { q = c; cur += c; }
      else if (c === ',') { items.push(cur); cur = ''; }
      else cur += c;
    }
    if (cur.trim() !== '' || items.length) items.push(cur);
    return items.map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
  }

  /**
   * frontmatter を解析する。
   * 返り値: { ok, errors:[{code,msg,line}], data:{key:value}, keys:[...], fmText, body, hadBom, hadCrlf }
   *   value は文字列 / 真偽値 / 文字列配列（ブロック・インライン両形式）/ ネスト構造は { __raw: "..." }
   */
  function parseFrontmatter(text) {
    var src = String(text == null ? '' : text);
    var res = { ok: false, errors: [], data: {}, keys: [], fmText: '', body: '', hadBom: /^﻿/.test(src), hadCrlf: /\r\n/.test(src) };
    var t = normalizeText(src);
    var lines = t.split('\n');
    if (!/^---[ \t]*$/.test(lines[0] || '')) {
      if (/^\+\+\+/.test(lines[0] || '')) res.errors.push({ code: 'FM_TOML', line: 1, msg: 'TOML 形式（+++）の frontmatter には対応していません。--- で囲んだ YAML にしてください' });
      else res.errors.push({ code: 'FM_NO_START', line: 1, msg: 'frontmatter の開始区切り（1行目の ---）がありません' + ((lines[0] || '').trim() ? '（1行目：' + (lines[0] || '').slice(0, 40) + '）' : '') });
      return res;
    }
    var end = -1;
    for (var i = 1; i < lines.length; i++) { if (/^---[ \t]*$/.test(lines[i])) { end = i; break; } }
    if (end < 0) { res.errors.push({ code: 'FM_NO_END', line: lines.length, msg: 'frontmatter の終了区切り（---）がありません' }); return res; }
    res.fmText = lines.slice(1, end).join('\n');
    res.body = lines.slice(end + 1).join('\n');

    var errs = [];
    var cur = null; /* {key, mode:'list'|'map'|'pending', items:[], raw:[]} */
    function flush() {
      if (!cur) return;
      if (cur.mode === 'list') res.data[cur.key] = cur.items;
      else if (cur.mode === 'map') res.data[cur.key] = { __raw: cur.raw.join('\n') };
      else res.data[cur.key] = '';
      cur = null;
    }
    for (var k = 1; k < end; k++) {
      var line = lines[k], ln = k + 1;
      if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;
      if (/^\t/.test(line)) { errs.push({ line: ln, msg: 'インデントにタブ文字が使われています（半角スペースにしてください）' }); continue; }
      if (/^\s/.test(line)) {
        if (!cur) { errs.push({ line: ln, msg: '項目名のない字下げ行があります：' + line.trim().slice(0, 40) }); continue; }
        var li = /^\s+-\s+(.*)$/.exec(line) || /^\s+-$/.exec(line);
        if (li && cur.mode !== 'map' && !/^\s+-\s+[A-Za-z_][\w-]*:\s/.test(line) && !/^\s+-\s+[A-Za-z_][\w-]*:$/.test(line)) {
          cur.mode = 'list';
          cur.items.push(String(scalar(li[1] || '', ln, errs)));
        } else {
          /* ネストしたマップ・マップのリスト（cover:, sources:, faq: など）は中身を解釈しない */
          if (cur.mode === 'list' && cur.items.length && !cur.raw.length) cur.raw = cur.items.map(function (x) { return '  - ' + x; });
          cur.mode = 'map';
          cur.raw.push(line);
        }
        continue;
      }
      var m = /^([A-Za-z_][\w-]*)\s*:(?:\s+(.*)|\s*)$/.exec(line);
      if (!m) { errs.push({ line: ln, msg: '解釈できない行があります：' + line.slice(0, 40) }); continue; }
      flush();
      var key = m[1], val = m[2] == null ? '' : m[2];
      if (Object.prototype.hasOwnProperty.call(res.data, key) || res.keys.indexOf(key) >= 0) {
        errs.push({ line: ln, msg: '項目「' + key + '」が2回書かれています' });
      }
      res.keys.push(key);
      var vt = val.trim();
      if (vt === '' || /^#/.test(vt)) { cur = { key: key, mode: 'pending', items: [], raw: [] }; continue; }
      if (vt[0] === '[') {
        if (!/\]\s*(#.*)?$/.test(vt)) { errs.push({ line: ln, msg: '「' + key + '」の [ ] が閉じていません' }); res.data[key] = []; continue; }
        var inner = vt.slice(1, vt.lastIndexOf(']'));
        res.data[key] = splitInline(inner).map(function (x) { return String(scalar(x, ln, errs)); });
        continue;
      }
      if (vt[0] === '{') { res.data[key] = { __raw: vt }; continue; }
      if (vt === '|' || vt === '>' || /^[|>][-+]?$/.test(vt)) { cur = { key: key, mode: 'map', items: [], raw: [] }; continue; }
      res.data[key] = scalar(vt, ln, errs);
    }
    flush();
    errs.forEach(function (e) { res.errors.push({ code: 'FM_SYNTAX', line: e.line, msg: e.line + '行目：' + e.msg }); });
    res.ok = res.errors.length === 0;
    return res;
  }

  /* ───────────── 日付 ───────────── */

  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

  /**
   * Hugo の解釈に合わせて日時を読む（hugo.yaml に timeZone 指定なし → タイムゾーン無しは UTC 扱い）。
   * 返り値: { ok, code, msg, epochMs, hasTime, hasTz, offsetMin, jst:{y,m,d,hh,mm} }
   */
  function parseDate(value) {
    if (value === undefined || value === null || value === '') return { ok: false, code: 'DATE_MISSING', msg: 'date が設定されていません' };
    if (typeof value !== 'string') return { ok: false, code: 'DATE_FORMAT', msg: 'date の形式が正しくありません（例：2026-10-04T18:30:00+09:00）' };
    var m = DATE_RE.exec(value.trim());
    if (!m) return { ok: false, code: 'DATE_FORMAT', msg: 'date の形式が正しくありません：「' + value + '」（例：2026-10-04T18:30:00+09:00）' };
    var y = +m[1], mo = +m[2], d = +m[3], hh = m[4] ? +m[4] : 0, mi = m[5] ? +m[5] : 0, ss = m[6] ? +m[6] : 0;
    var probe = new Date(Date.UTC(y, mo - 1, d, hh, mi, ss));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d || hh > 23 || mi > 59 || ss > 59) {
      return { ok: false, code: 'DATE_INVALID', msg: 'date に存在しない日時が指定されています：「' + value + '」' };
    }
    var off = 0, hasTz = !!m[7];
    if (hasTz && m[7] !== 'Z') {
      var tz = m[7].replace(':', '');
      off = (tz[0] === '-' ? -1 : 1) * (parseInt(tz.slice(1, 3), 10) * 60 + parseInt(tz.slice(3, 5), 10));
    }
    var epoch = probe.getTime() - off * 60000;
    var j = new Date(epoch + JST_OFFSET_MIN * 60000);
    return {
      ok: true, epochMs: epoch, hasTime: !!m[4], hasTz: hasTz, offsetMin: off,
      jst: { y: j.getUTCFullYear(), m: j.getUTCMonth() + 1, d: j.getUTCDate(), hh: j.getUTCHours(), mm: j.getUTCMinutes() }
    };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtJst(p) { return p.jst.y + '-' + pad2(p.jst.m) + '-' + pad2(p.jst.d) + ' ' + pad2(p.jst.hh) + ':' + pad2(p.jst.mm); }

  /* eventDate は "YYYY-MM-DD" / "YYYY-MM-DD/YYYY-MM-DD" / 配列 を許容（layouts/_default/events.html と同じ） */
  function checkEventDate(v) {
    var list = Array.isArray(v) ? v : String(v).split('/');
    for (var i = 0; i < list.length; i++) {
      var s = String(list[i]).trim().slice(0, 10);
      var p = parseDate(s);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !p.ok) return false;
    }
    return list.length > 0;
  }

  /* ───────────── ファイル名・URL ───────────── */

  function langOfPath(path) {
    var m = /\.(en|zh|zh-tw|ko)\.md$/.exec(path || '');
    return m ? m[1] : 'ja';
  }
  function baseName(path) {
    return String(path || '').split('/').pop();
  }
  /* ファイル名 YYYYMMDD-xxx(.lang).md → { datePrefix, stem } */
  function splitFileName(path) {
    var b = baseName(path).replace(/\.(en|zh|zh-tw|ko)\.md$/, '').replace(/\.md$/, '');
    var m = /^(\d{8})-(.+)$/.exec(b);
    return m ? { datePrefix: m[1], stem: m[2] } : { datePrefix: null, stem: b };
  }
  function langPrefix(lang) { return lang && lang !== 'ja' ? '/' + lang : ''; }
  function normUrl(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    s = s.replace(/^https?:\/\/[^/]+/, '');
    try { s = decodeURI(s); } catch (e) { /* そのまま */ }
    if (s[0] !== '/') s = '/' + s;
    if (!/\/$/.test(s) && !/\.[a-z0-9]+$/i.test(s)) s += '/';
    return s.toLowerCase();
  }
  /* slug / url 指定から想定 URL を返す（slug も url も無い場合は null＝ファイル名由来で Hugo に任せる） */
  function expectedUrl(path, data) {
    var lang = langOfPath(path);
    if (data && typeof data.url === 'string' && data.url) return normUrl(langPrefix(lang) + (data.url[0] === '/' ? '' : '/') + data.url);
    if (data && typeof data.slug === 'string' && data.slug) return normUrl(langPrefix(lang) + '/posts/' + data.slug + '/');
    return null;
  }

  /* ───────────── 記事の検証 ───────────── */

  function add(list, code, msg) { list.push({ code: code, msg: msg }); }

  /**
   * 記事1本を検証する。
   * ctx: { path, isNew, now(Date|ms), skipBodyChecks, skipLastmodChecks }
   * 返り値: { errors:[{code,msg}], warnings:[{code,msg}], info:[{code,msg}], fm, date }
   */
  function validatePost(text, ctx) {
    ctx = ctx || {};
    var isNew = ctx.isNew !== false;
    var now = ctx.now == null ? Date.now() : +ctx.now;
    var path = ctx.path || '';
    var lang = langOfPath(path);
    var errors = [], warnings = [], info = [];
    var fm = parseFrontmatter(text);
    if (!fm.ok && (fm.errors[0].code === 'FM_NO_START' || fm.errors[0].code === 'FM_NO_END' || fm.errors[0].code === 'FM_TOML')) {
      fm.errors.forEach(function (e) { add(errors, e.code, e.msg); });
      return { errors: errors, warnings: warnings, info: info, fm: fm, date: null };
    }
    fm.errors.forEach(function (e) { add(errors, e.code, 'frontmatter の書式に誤りがあります（' + e.msg + '）'); });
    if (fm.hadBom) add(info, 'FM_BOM', '先頭の BOM は投稿時に取り除きます（記事への影響はありません）');
    var d = fm.data;

    /* title */
    if (typeof d.title !== 'string' || !d.title.trim()) add(errors, 'TITLE_MISSING', 'title が設定されていません');

    /* date */
    var dp = parseDate(d.date);
    if (!dp.ok) add(errors, dp.code, dp.msg);
    else {
      if (!dp.hasTz) add(warnings, 'DATE_NO_TZ', 'date にタイムゾーン（+09:00）がありません。Hugo は UTC として扱うため、日本時間で ' + fmtJst(dp) + ' の扱いになります。意図した時刻か確認してください');
      if (dp.epochMs > now) {
        var days = (dp.epochMs - now) / 86400000;
        if (days > FAR_FUTURE_DAYS) add(warnings, 'DATE_FAR_FUTURE', '公開日時が ' + Math.floor(days) + ' 日先（日本時間 ' + fmtJst(dp) + '）になっています。年や月の誤入力ではないか確認してください。予約投稿の場合は、この時刻より後のビルドで公開されます');
        else add(warnings, 'DATE_FUTURE', '未来の公開日時（日本時間 ' + fmtJst(dp) + '）が指定されています。予約投稿として扱われ、この時刻より後のビルドまで公開されません。予約投稿であることを確認してください');
      }
      var fnParts = splitFileName(path);
      if (fnParts.datePrefix) {
        var jd = '' + dp.jst.y + pad2(dp.jst.m) + pad2(dp.jst.d);
        if (jd !== fnParts.datePrefix) add(warnings, 'DATE_FILENAME_MISMATCH', 'ファイル名の日付（' + fnParts.datePrefix + '）と date の日付（日本時間 ' + jd + '）が一致しません');
      }
    }

    /* slug / url */
    var hasUrl = typeof d.url === 'string' && d.url !== '';
    if (d.slug === undefined || d.slug === '') {
      if (isNew && !hasUrl) add(errors, 'SLUG_MISSING', 'slug が設定されていません（例：slug: "urayasu-example-2026"）');
    } else if (typeof d.slug !== 'string' || !SLUG_RE.test(d.slug)) {
      (isNew ? errors : warnings).push({ code: 'SLUG_FORMAT', msg: 'slug の形式が正しくありません：「' + d.slug + '」（半角英小文字・数字・ハイフンのみ。先頭と末尾にハイフン不可）' });
    }

    /* categories（翻訳版は categories を持たない運用なので、ja のみ必須） */
    var cats = d.categories;
    if (cats === undefined || cats === '' || (Array.isArray(cats) && cats.length === 0)) {
      if (lang === 'ja' && isNew) add(errors, 'CATEGORY_MISSING', 'categories が設定されていません（' + ALLOWED_CATEGORIES.join('／') + ' から選択）');
    } else {
      var arr = Array.isArray(cats) ? cats : (typeof cats === 'string' ? [cats] : null);
      if (!arr) add(errors, 'CATEGORY_FORMAT', 'categories の書き方が正しくありません（- "イベント" の形式で列挙してください）');
      else arr.forEach(function (c) {
        if (/^cat-/.test(c)) add(errors, 'CATEGORY_NOT_ALLOWED', 'categories に不正な値が含まれています：「' + c + '」（画像用の catimg 値です）');
        else if (ALLOWED_CATEGORIES.indexOf(c) < 0) add(errors, 'CATEGORY_NOT_ALLOWED', 'categories に許可されていない値が含まれています：「' + c + '」（' + ALLOWED_CATEGORIES.join('／') + ' から選択）');
      });
    }

    /* draft（既存の運用ルール：draft: false を明記） */
    if (d.draft !== false) {
      if (d.draft === true) add(errors, 'DRAFT_TRUE', 'draft: true になっています（公開されません）。公開する場合は draft: false にしてください');
      else add(errors, 'DRAFT_MISSING', 'draft: false がありません');
    }

    /* eventDate（既存の運用ルール：hideEventBox: true が必須） */
    var hasEvent = (d.eventDate !== undefined && d.eventDate !== '') || d.eventDates !== undefined;
    if (hasEvent && d.hideEventBox !== true) add(errors, 'EVENT_HIDEBOX', 'eventDate(s) があるのに hideEventBox: true がありません');
    if (d.eventDate !== undefined && d.eventDate !== '' && !checkEventDate(d.eventDate)) {
      add(warnings, 'EVENTDATE_FORMAT', 'eventDate の形式が正しくありません：「' + (Array.isArray(d.eventDate) ? d.eventDate.join(', ') : d.eventDate) + '」（"2026-10-04" または "2026-10-04/2026-10-05"）。イベントカレンダーに載りません');
    }
    if (d.eventDate === '') add(warnings, 'EVENTDATE_EMPTY', 'eventDate が空です');

    /* lastmod（CLAUDE.md の運用ルール） */
    var hasLastmod = d.lastmod !== undefined && d.lastmod !== '';
    if (!ctx.skipLastmodChecks && isNew && hasLastmod) add(warnings, 'LASTMOD_ON_NEW', '新規投稿なのに lastmod が設定されています');
    if (!ctx.skipLastmodChecks && !isNew && !hasLastmod) add(warnings, 'LASTMOD_MISSING', '更新なのに lastmod が設定されていません');

    if (!ctx.skipBodyChecks) {
      var body = fm.body;
      var fmt = fm.fmText;
      var hasCheckDate = d.checkDate !== undefined;
      if (hasCheckDate && /<h2>\s*参考情報\s*<\/h2>/.test(body)) add(warnings, 'SOURCES_LEFTOVER', 'checkDate があるのに本文に「参考情報」見出しが残っています（sources移行漏れ）');
      if (hasCheckDate && !/^sources:/m.test(fmt)) add(warnings, 'SOURCES_MISSING', 'checkDate があるのに frontmatter に sources: がありません');
      if (/<div\s+style=/.test(body)) add(warnings, 'BODY_DIV_STYLE', '本文に <div style=...> が含まれています');
      var nonMap = (body.match(/<iframe[^>]*>/gi) || []).some(function (tg) { return !/google\.com\/maps|maps\.google/i.test(tg); });
      if (nonMap) add(warnings, 'BODY_IFRAME', '本文に地図以外の <iframe> が含まれています');
      var plainLen = body.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
      if (plainLen < 300) add(warnings, 'BODY_SHORT', '本文が' + plainLen + '字と短めです（まとめ記事への統合を検討してください）');
      if (/<img[^>]*\balt=""[^>]*>/.test(body)) add(warnings, 'BODY_EMPTY_ALT', 'alt が空の画像があります');
    }

    return { errors: errors, warnings: warnings, info: info, fm: fm, date: dp.ok ? dp : null };
  }

  /* ───────────── URL 衝突 ───────────── */

  /**
   * URL → 所有ファイルの索引を作る。entries: [{ path, url, aliases:[] }]
   */
  function buildUrlIndex(entries) {
    var idx = {};
    (entries || []).forEach(function (e) {
      if (e.url) (idx[normUrl(e.url)] = idx[normUrl(e.url)] || []).push({ path: e.path, via: 'url' });
      (e.aliases || []).forEach(function (a) {
        var u = normUrl(a);
        if (u) (idx[u] = idx[u] || []).push({ path: e.path, via: 'alias' });
      });
    });
    return idx;
  }
  /** 候補（path, url, aliases）が索引の他ファイルと衝突するか。同じファイル自身は除外 */
  function findConflicts(index, cand) {
    var out = [];
    var urls = [];
    if (cand.url) urls.push({ u: normUrl(cand.url), via: 'url' });
    (cand.aliases || []).forEach(function (a) { urls.push({ u: normUrl(a), via: 'alias' }); });
    urls.forEach(function (x) {
      (index[x.u] || []).forEach(function (o) {
        if (o.path !== cand.path) out.push({ url: x.u, candidateVia: x.via, otherPath: o.path, otherVia: o.via });
      });
    });
    return out;
  }
  /** aliases の値を、実際に出力されるパスの配列で返す。
      非日本語ページでは "/" 始まりの alias にも言語プレフィックスが付く（Hugo の挙動。2026-10-04 ビルドで確認） */
  function aliasesOf(data, lang) {
    var a = data && data.aliases;
    if (!a) return [];
    var list = Array.isArray(a) ? a : (typeof a === 'string' ? [a] : []);
    return list.map(function (x) { return langPrefix(lang) + (x[0] === '/' ? x : '/' + x); });
  }

  return {
    ALLOWED_CATEGORIES: ALLOWED_CATEGORIES,
    SLUG_RE: SLUG_RE,
    LANGS: LANGS,
    normalizeText: normalizeText,
    parseFrontmatter: parseFrontmatter,
    parseDate: parseDate,
    fmtJst: fmtJst,
    checkEventDate: checkEventDate,
    langOfPath: langOfPath,
    splitFileName: splitFileName,
    langPrefix: langPrefix,
    normUrl: normUrl,
    expectedUrl: expectedUrl,
    aliasesOf: aliasesOf,
    validatePost: validatePost,
    buildUrlIndex: buildUrlIndex,
    findConflicts: findConflicts
  };
});
