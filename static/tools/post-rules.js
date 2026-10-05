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

  /* ───────────── 開催日（eventDate / eventDates） ─────────────
   * 値の「形式と実在性」だけを検証する。どのカテゴリの記事に付けるかは問わない
   * （記事化プロンプト v20260907 では eventDate は「注目の日」で、開店日・閉店日・試合日などにも使う）。
   *
   * 書式（プロンプト v20260907・既存記事と同じ）:
   *   eventDate:  "YYYY-MM-DD"（単日）／"YYYY-MM-DD/YYYY-MM-DD"（連続期間）。終了日未定は単日＋eventOngoing: true
   *   eventDates: リスト。要素は "YYYY-MM-DD" または "YYYY-MM-DD/YYYY-MM-DD"（複数の会期）
   *
   * Hugo 0.167.0 で実際にビルドを止める値（2026-10-05 に1件ずつビルドして確認）→ エラー:
   *   実在しない日付（2026-02-30・2026-13-01・平年の 2/29）、日付として読めない値、期間の区切りの前後の空白、
   *   「〜」「,」による区切り、YYYY/MM/DD 形式（いずれも終了通知 partial の time 関数）、
   *   eventDate の配列要素に期間を書く（同上）、eventDates がリストでない（/daily/ の range）
   * ビルドは通るが誤った表示・構造化データになる値 → エラー: 逆順の期間、3つ以上の区切り、空の値
   * ビルドが通り表示も保てる値 → 警告: eventDate の配列、eventDate と eventDates の併用、時刻付き、
   *   eventDates の1件だけ・未整列・重複。連続する日だけの eventDates は情報
   */
  var YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var EVENT_DATETIME_RE = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/;

  function isRealYmd(s) {
    var m = YMD_RE.exec(s);
    if (!m) return false;
    var y = +m[1], mo = +m[2], d = +m[3];
    var p = new Date(Date.UTC(y, mo - 1, d));
    return p.getUTCFullYear() === y && p.getUTCMonth() === mo - 1 && p.getUTCDate() === d;
  }
  function nextYmd(s) {
    var m = YMD_RE.exec(s);
    var p = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1));
    return p.getUTCFullYear() + '-' + pad2(p.getUTCMonth() + 1) + '-' + pad2(p.getUTCDate());
  }
  function showVal(v) { return Array.isArray(v) ? '[' + v.join(', ') + ']' : String(v); }

  /**
   * 開催日の値1つ（単日、または期間 "A/B"）を解析する。
   * p: { code: 'EVENTDATE' | 'EVENTDATES'（コードの接頭辞）, label: 表示名, allowRange: 期間を許すか }
   * 返り値: { ok, start, end, isRange, problems: [{ level: 'error'|'warning'|'info', code, msg }] }
   */
  function parseEventValue(raw, p) {
    var probs = [];
    var put = function (level, code, msg) { probs.push({ level: level, code: p.code + '_' + code, msg: p.label + '：' + msg }); };
    var res = { ok: false, start: null, end: null, isRange: false, problems: probs };
    if (typeof raw !== 'string') { put('error', 'FORMAT', '日付ではない値です（「' + showVal(raw) + '」）。"YYYY-MM-DD" の形式で書いてください'); return res; }
    if (raw.trim() === '') { put('error', 'EMPTY', '値が空です。日付が無い場合は項目ごと削除してください'); return res; }
    var s = raw;
    if (s !== s.trim()) { put('error', 'SPACED', '値の前後に空白があります（「' + s + '」）。空白があるとサイトのビルドが止まります'); return res; }
    if (/[０-９－／]/.test(s)) { put('error', 'FORMAT', '全角の数字・記号が含まれています（「' + s + '」）。半角の "YYYY-MM-DD" で書いてください'); return res; }
    if (/[〜～~,，、]/.test(s)) {
      put('error', 'SEPARATOR', '区切り文字が正しくありません（「' + s + '」）。期間は "開始日/終了日"、飛び飛びの日程は eventDates のリストで書いてください');
      return res;
    }
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) { put('error', 'FORMAT', 'スラッシュ区切りの日付は使えません（「' + s + '」）。"YYYY-MM-DD" の形式で書いてください'); return res; }
    var dt = EVENT_DATETIME_RE.exec(s);
    if (dt) {
      if (!isRealYmd(dt[1])) { put('error', 'INVALID', '存在しない日付です（「' + s + '」）'); return res; }
      if (p.allowTime === false) { put('error', 'FORMAT', '時刻を付けずに "YYYY-MM-DD" で書いてください（「' + s + '」）'); return res; }
      put('warning', 'HAS_TIME', '時刻が付いています（「' + s + '」）。時刻は使われないため、"YYYY-MM-DD" だけで書いてください');
      res.ok = true; res.start = res.end = dt[1]; return res;
    }
    var parts = s.split('/');
    if (parts.length > 2) { put('error', 'TOO_MANY_PARTS', '区切り「/」が2つ以上あります（「' + s + '」）。期間は "開始日/終了日" の2つまで。飛び飛びの日程は eventDates のリストで書いてください'); return res; }
    if (parts.length === 2 && !p.allowRange) { put('error', 'RANGE_NOT_ALLOWED', 'ここには期間（「' + s + '」）を書けません。単日の "YYYY-MM-DD" にしてください'); return res; }
    if (parts.length === 2 && /\s/.test(s)) { put('error', 'SPACED', '区切り「/」の前後に空白があります（「' + s + '」）。空白があるとサイトのビルドが止まります。"YYYY-MM-DD/YYYY-MM-DD" と詰めて書いてください'); return res; }
    for (var i = 0; i < parts.length; i++) {
      if (!YMD_RE.test(parts[i])) { put('error', 'FORMAT', '日付の形式が正しくありません（「' + s + '」）。"YYYY-MM-DD"' + (p.allowRange ? ' または "YYYY-MM-DD/YYYY-MM-DD"' : '') + ' で書いてください'); return res; }
      if (!isRealYmd(parts[i])) { put('error', 'INVALID', '存在しない日付です（「' + parts[i] + '」）。月日を確認してください'); return res; }
    }
    res.start = parts[0]; res.end = parts[parts.length - 1]; res.isRange = parts.length === 2;
    if (res.isRange && res.end < res.start) { put('error', 'REVERSED', '期間の終了日が開始日より前です（「' + s + '」）'); return res; }
    if (res.isRange && res.end === res.start) put('info', 'SAME_DAY', '開始日と終了日が同じ期間です（「' + s + '」）。単日の "' + res.start + '" と同じ扱いになります');
    res.ok = true;
    return res;
  }

  /**
   * eventDate・eventDates・eventOngoing をまとめて検証する。
   * 返り値: { eventDate: [problem], eventDates: [problem], common: [problem] }（項目ごとに分ける＝更新時に「変更していない項目」を区別するため）
   */
  function checkEventFields(d) {
    var out = { eventDate: [], eventDates: [], common: [] };
    var pushAll = function (list, probs) { probs.forEach(function (x) { list.push(x); }); };
    var single = null, multi = null;

    if (d.eventDate !== undefined) {
      var ed = d.eventDate;
      if (Array.isArray(ed)) {
        if (!ed.length) out.eventDate.push({ level: 'error', code: 'EVENTDATE_EMPTY', msg: 'eventDate が空のリストです。日付が無い場合は項目ごと削除してください' });
        else {
          out.eventDate.push({ level: 'warning', code: 'EVENTDATE_ARRAY', msg: 'eventDate がリストになっています（' + showVal(ed) + '）。複数の日程は eventDates のリストに書いてください（現在は初日〜最終日の期間として扱われます）' });
          var okAll = true;
          ed.forEach(function (x, i) {
            var r = parseEventValue(x, { code: 'EVENTDATE', label: 'eventDate の' + (i + 1) + '番目', allowRange: false });
            pushAll(out.eventDate, r.problems); if (!r.ok) okAll = false;
          });
          if (okAll) single = ed.slice();
        }
      } else if (d.eventDate === '') {
        out.eventDate.push({ level: 'error', code: 'EVENTDATE_EMPTY', msg: 'eventDate が空です。日付が無い場合は項目ごと削除してください' });
      } else {
        var r1 = parseEventValue(ed, { code: 'EVENTDATE', label: 'eventDate', allowRange: true });
        pushAll(out.eventDate, r1.problems);
        if (r1.ok) single = r1.isRange ? [r1.start, r1.end] : [r1.start];
        if (r1.ok && r1.isRange && d.eventOngoing === true) {
          out.common.push({ level: 'warning', code: 'EVENTONGOING_WITH_RANGE', msg: 'eventOngoing: true と終了日のある期間（「' + ed + '」）が両方あります。終了日が判明したら eventOngoing を削除してください' });
        }
      }
    }

    if (d.eventDates !== undefined) {
      var eds = d.eventDates;
      if (!Array.isArray(eds)) {
        if (eds === '') out.eventDates.push({ level: 'error', code: 'EVENTDATES_EMPTY', msg: 'eventDates が空です。日付が無い場合は項目ごと削除してください' });
        else out.eventDates.push({ level: 'error', code: 'EVENTDATES_NOT_LIST', msg: 'eventDates がリストになっていません（「' + showVal(eds) + '」）。リストでないとサイトのビルドが止まります。1日ずつ「  - "YYYY-MM-DD"」の行で書くか、単日・連続期間なら eventDate を使ってください' });
      } else if (!eds.length) {
        out.eventDates.push({ level: 'error', code: 'EVENTDATES_EMPTY', msg: 'eventDates が空のリストです。日付が無い場合は項目ごと削除してください' });
      } else {
        var parsed = [], allOk = true;
        eds.forEach(function (x, i) {
          var r = parseEventValue(x, { code: 'EVENTDATES', label: 'eventDates の' + (i + 1) + '番目', allowRange: true });
          pushAll(out.eventDates, r.problems);
          if (r.ok) parsed.push(r); else allOk = false;
        });
        if (allOk) {
          multi = eds.slice();
          if (eds.length === 1) out.eventDates.push({ level: 'warning', code: 'EVENTDATES_SINGLE', msg: 'eventDates の日付が1つだけです（「' + eds[0] + '」）。単日・連続期間は eventDate に書いてください' });
          var unsorted = parsed.some(function (r, i) { return i > 0 && r.start < parsed[i - 1].start; });
          if (unsorted) out.eventDates.push({ level: 'warning', code: 'EVENTDATES_UNSORTED', msg: 'eventDates の日付が古い順に並んでいません（' + showVal(eds) + '）' });
          var seen = {}, dups = [];
          eds.forEach(function (x) { if (seen[x]) dups.push(x); seen[x] = true; });
          if (dups.length) out.eventDates.push({ level: 'warning', code: 'EVENTDATES_DUPLICATE', msg: 'eventDates に同じ日付が重複しています（' + dups.join(', ') + '）' });
          var consecutive = eds.length > 1 && !unsorted && parsed.every(function (r, i) { return !r.isRange && (i === 0 || r.start === nextYmd(parsed[i - 1].start)); });
          if (consecutive) out.eventDates.push({ level: 'info', code: 'EVENTDATES_CONSECUTIVE', msg: 'eventDates が連続した日付だけです。連続期間は eventDate: "' + eds[0] + '/' + eds[eds.length - 1] + '" とも書けます' });
        }
      }
    }

    var hasEd = d.eventDate !== undefined && d.eventDate !== '' && !(Array.isArray(d.eventDate) && !d.eventDate.length);
    var hasEds = Array.isArray(d.eventDates) && d.eventDates.length > 0;
    if (hasEd && hasEds) {
      var same = single && multi && single.slice().sort().join('|') === multi.slice().sort().join('|');
      out.common.push(same
        ? { level: 'info', code: 'EVENT_BOTH_SAME', msg: 'eventDate と eventDates に同じ日付が書かれています。どちらか一方にしてください' }
        : { level: 'warning', code: 'EVENT_BOTH', msg: 'eventDate と eventDates が両方あります（イベントカレンダーは eventDate だけを使います）。どちらか一方にしてください' });
    }
    if (d.eventOngoing === true && !hasEd) {
      out.common.push({ level: 'warning', code: 'EVENTONGOING_NO_DATE', msg: 'eventOngoing: true がありますが eventDate がありません（開始日を eventDate に書いてください）' });
    }
    return out;
  }

  /* 後方互換: 以前の公開関数（true = 形式に問題なし）。新しい検証は checkEventFields を使う */
  function checkEventDate(v) {
    var r = checkEventFields({ eventDate: v });
    return !r.eventDate.some(function (x) { return x.level === 'error'; });
  }

  /* 更新時の比較用に値を正規化（クォートの有無などの書き方の違いは無視し、値の違いだけを見る） */
  function canonValue(v) {
    if (v === undefined) return '\u0000none';
    return JSON.stringify(v);
  }

  /* ───────────── 新しい日付・店舗情報の項目（工程1a PR 1a-2） ─────────────
   * 項目を受け入れて形式を検証する（表示での使い方は CLAUDE.md。eventKind・calendar は PR 3・4、shopStatus・shopDate・
   * shopUnconfirmed は PR 5 の開店・閉店年表・/daily/ が使う）。shopStatus は PR 5 で popup（期間限定出店）を加えて10種類。
   * すべて任意項目。店舗の状態の食い違い・新規の開店・閉店記事の shopStatus 無しは、下の checkShopConsistency が警告する。
   *
   * Hugo 0.167.0 で実際にビルドを止める値（2026-10-05 に確認）→ エラー: notableDates がリストでない（サイドバーの range）
   * ビルドは通るが、意図どおりに動かない値 → エラー: 語彙外の値、実在しない日付・年月、日付として読めない値、
   *   真偽値でない shopUnconfirmed・calendar（引用符付きの "true" は文字列）
   */
  var EVENT_KINDS = ['event', 'match', 'fair'];
  var SHOP_STATUSES = ['open', 'open_planned', 'close', 'close_planned', 'temp_close', 'reopen', 'renewal', 'move', 'feature', 'popup'];
  var NEW_FIELDS = ['eventKind', 'notableDate', 'notableDates', 'shopStatus', 'shopDate', 'shopUnconfirmed', 'calendar'];

  /* ---------- 店舗の状態の整合（工程1a PR 5） ----------
   * 形式（語彙・shopDate・shopUnconfirmed）は上の checkNewFields がエラーにする。ここは食い違いの警告だけ（投稿・公開は止めない）。
   *   SHOPSTATUS_MISSING        : 「開店・閉店」カテゴリの新規記事で shopStatus が無い（SHOP_STATUS_FROM 以降の date の記事だけ。
   *                               それより前の既存記事は年表がタイトルなどから分類するので警告しない）
   *   SHOP_FIELDS_WITHOUT_STATUS: shopDate・shopUnconfirmed があるのに shopStatus が無い
   *   SHOP_CONFIRMED_FUTURE     : open・close（確認済み）なのに shopDate が未来（予定なら open_planned・close_planned）
   *   SHOP_PLANNED_PASSED       : open_planned・close_planned の予定日を過ぎている（自動で open・close にしない。確認できたら更新）
   *                               日付は翌日から、年月だけならその月が終わってから。日本時間
   *   SHOP_UNCONFIRMED_FEATURE  : まとめ（feature）に shopUnconfirmed: true
   */
  var SHOP_STATUS_FROM = '2026-10-07';
  function jstToday(now) { return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10); }
  function checkShopConsistency(d, now, isNew, dp) {
    var out = [];
    var cats = Array.isArray(d.categories) ? d.categories : (typeof d.categories === 'string' ? [d.categories] : []);
    var st = d.shopStatus;
    var postDay = dp && dp.ok ? dp.jst.y + '-' + pad2(dp.jst.m) + '-' + pad2(dp.jst.d) : '';
    if (st === undefined) {
      if (isNew && cats.indexOf('開店・閉店') >= 0 && postDay >= SHOP_STATUS_FROM) {
        out.push({ code: 'SHOPSTATUS_MISSING', msg: '開店・閉店の記事に shopStatus がありません（' + SHOP_STATUSES.join('／') + '）。年表の分類と件数に使います' });
      }
      if (d.shopDate !== undefined || d.shopUnconfirmed !== undefined) {
        out.push({ code: 'SHOP_FIELDS_WITHOUT_STATUS', msg: 'shopDate・shopUnconfirmed があるのに shopStatus がありません。状態（' + SHOP_STATUSES.join('／') + '）を書いてください' });
      }
      return out;
    }
    if (typeof st !== 'string' || SHOP_STATUSES.indexOf(st) < 0) return out;
    var today = jstToday(now);
    var sd = typeof d.shopDate === 'string' ? d.shopDate.trim() : '';
    var kind = /^\d{4}-\d{2}-\d{2}$/.test(sd) && isRealYmd(sd) ? 'day' : (/^\d{4}-(0[1-9]|1[0-2])$/.test(sd) ? 'month' : '');
    if (kind) {
      var future = kind === 'day' ? sd > today : sd > today.slice(0, 7);
      var passed = kind === 'day' ? sd < today : sd < today.slice(0, 7);
      if ((st === 'open' || st === 'close') && future) {
        out.push({ code: 'SHOP_CONFIRMED_FUTURE', msg: 'shopStatus が ' + st + '（確認済み）なのに shopDate（' + sd + '）が未来です。予定なら ' + st + '_planned にしてください' });
      }
      if ((st === 'open_planned' || st === 'close_planned') && passed) {
        out.push({ code: 'SHOP_PLANNED_PASSED', msg: (st === 'open_planned' ? '開店' : '閉店') + '予定日（' + sd + '）を過ぎています（予定日経過・未確認）。' + (st === 'open_planned' ? '開店' : '閉店') + 'を確認できたら shopStatus を ' + st.replace('_planned', '') + ' にし、shopDate を実際の日にしてください' });
      }
    }
    if (st === 'feature' && d.shopUnconfirmed === true) {
      out.push({ code: 'SHOP_UNCONFIRMED_FEATURE', msg: 'まとめ（feature）に shopUnconfirmed: true が付いています。未確認の印は個別の店舗の状態に付けてください' });
    }
    return out;
  }

  function checkVocab(v, field, code, vocab, out) {
    if (v === undefined) return;
    if (typeof v !== 'string' || vocab.indexOf(v) < 0) {
      out.push({ level: 'error', code: code, msg: field + ' の値「' + showVal(v) + '」は使えません（' + vocab.join('／') + ' のいずれか）' });
    }
  }
  function checkBool(v, field, code, out) {
    if (v === undefined || v === true || v === false) return;
    var quoted = v === 'true' || v === 'false';
    out.push({ level: 'error', code: code, msg: field + ' は真偽値の true または false で書いてください（「' + showVal(v) + '」' + (quoted ? '。引用符で囲むと文字列になります' : '') + '）' });
  }

  /* ---------- 会場・主催者（工程1a PR 4） ----------
   * eventLocation（会場名）・organizer（主催者名）は Event 構造化データの根拠になる任意項目。
   * テンプレートは値をそのまま使い、推測・補完しない。不明・未定なら項目自体を書かない運用。
   *   エラー: 空・空白だけ、文字列でない（リスト・マップ・真偽値・引用符なしの数値・null）
   *   警告: 確定していない値（未定・未発表・不明・TBD など）、80文字を超える値
   */
  var EVENT_TEXT_FIELDS = ['eventLocation', 'organizer'];
  var UNCONFIRMED_RE = /未定|未発表|不明|未確定|調整中|確認中|要確認|\bTBD\b|\bTBA\b|\bTBC\b/i;
  function checkEventTextFields(d, fmText) {
    var out = {};
    EVENT_TEXT_FIELDS.forEach(function (f) {
      out[f] = [];
      var v = d[f];
      if (v === undefined) return;
      var code = f.toUpperCase();
      var raw = (new RegExp('^' + f + '\\s*:\\s*(.*)$', 'm').exec(fmText || '') || [])[1];
      raw = raw === undefined ? '' : raw.replace(/\s+#.*$/, '').trim();
      var unquotedScalar = raw !== '' && !/^["']/.test(raw);
      var notString = typeof v !== 'string' || (unquotedScalar && /^(-?\d+(\.\d+)?|null|~|yes|no|on|off)$/i.test(raw));
      if (notString) {
        out[f].push({ level: 'error', code: code + '_NOT_STRING', msg: f + ' は文字列で書いてください（「' + showVal(v) + '」）。リスト・真偽値・数値は使えません。値が無い場合は項目ごと削除してください' });
        return;
      }
      var t = v.replace(/[\s　]+/g, ' ').trim();
      if (t === '') {
        out[f].push({ level: 'error', code: code + '_EMPTY', msg: f + ' が空です。分からない場合は「未定」などと書かず、項目ごと削除してください' });
        return;
      }
      if (UNCONFIRMED_RE.test(t)) out[f].push({ level: 'warning', code: code + '_UNCONFIRMED', msg: f + ' に確定していない値が入っています（「' + t + '」）。構造化データにそのまま出るため、確定するまでは項目ごと削除してください' });
      if (t.length > 80) out[f].push({ level: 'warning', code: code + '_LONG', msg: f + ' が' + t.length + '文字と長すぎます（80文字まで）。' + (f === 'eventLocation' ? '会場名だけ' : '主催者名だけ') + 'を書いてください' });
    });
    return out;
  }

  /**
   * 新項目をまとめて検証する。返り値: { 項目名: [problem] }（更新時の「変更していない項目」の判定のため項目ごとに分ける）
   */
  function checkNewFields(d) {
    var out = {};
    NEW_FIELDS.forEach(function (f) { out[f] = []; });

    checkVocab(d.eventKind, 'eventKind', 'EVENTKIND_INVALID', EVENT_KINDS, out.eventKind);
    checkVocab(d.shopStatus, 'shopStatus', 'SHOPSTATUS_INVALID', SHOP_STATUSES, out.shopStatus);
    checkBool(d.shopUnconfirmed, 'shopUnconfirmed', 'SHOPUNCONFIRMED_NOT_BOOLEAN', out.shopUnconfirmed);
    checkBool(d.calendar, 'calendar', 'CALENDAR_NOT_BOOLEAN', out.calendar);

    /* notableDate: 単日 "YYYY-MM-DD" のみ（期間・時刻は不可。サイドバーは値をそのまま日付キーに使うため） */
    if (d.notableDate !== undefined) {
      if (Array.isArray(d.notableDate)) out.notableDate.push({ level: 'error', code: 'NOTABLEDATE_FORMAT', msg: 'notableDate には日付を1つだけ書いてください。複数の日付は notableDates のリストに書いてください' });
      else parseEventValue(d.notableDate, { code: 'NOTABLEDATE', label: 'notableDate', allowRange: false, allowTime: false }).problems.forEach(function (x) { out.notableDate.push(x); });
    }
    /* notableDates: 単日のリスト（リストでないとサイドバーでビルドが止まる） */
    if (d.notableDates !== undefined) {
      var nds = d.notableDates;
      if (!Array.isArray(nds)) {
        out.notableDates.push(nds === ''
          ? { level: 'error', code: 'NOTABLEDATES_EMPTY', msg: 'notableDates が空です。日付が無い場合は項目ごと削除してください' }
          : { level: 'error', code: 'NOTABLEDATES_NOT_LIST', msg: 'notableDates がリストになっていません（「' + showVal(nds) + '」）。リストでないとサイトのビルドが止まります。1日ずつ「  - "YYYY-MM-DD"」の行で書くか、1日だけなら notableDate を使ってください' });
      } else if (!nds.length) {
        out.notableDates.push({ level: 'error', code: 'NOTABLEDATES_EMPTY', msg: 'notableDates が空のリストです。日付が無い場合は項目ごと削除してください' });
      } else {
        var allOk = true;
        nds.forEach(function (x, i) {
          var r = parseEventValue(x, { code: 'NOTABLEDATES', label: 'notableDates の' + (i + 1) + '番目', allowRange: false, allowTime: false });
          r.problems.forEach(function (pb) { out.notableDates.push(pb); });
          if (!r.ok) allOk = false;
        });
        if (allOk) {
          if (nds.some(function (x, i) { return i > 0 && x < nds[i - 1]; })) out.notableDates.push({ level: 'warning', code: 'NOTABLEDATES_UNSORTED', msg: 'notableDates の日付が古い順に並んでいません（' + showVal(nds) + '）' });
          var seen = {}, dups = [];
          nds.forEach(function (x) { if (seen[x]) dups.push(x); seen[x] = true; });
          if (dups.length) out.notableDates.push({ level: 'warning', code: 'NOTABLEDATES_DUPLICATE', msg: 'notableDates に同じ日付が重複しています（' + dups.join(', ') + '）' });
        }
      }
    }

    /* shopDate: "YYYY-MM-DD" または "YYYY-MM"（年月だけ。月初・月末の日付に読み替えない） */
    if (d.shopDate !== undefined) {
      var sd = d.shopDate;
      var ym = typeof sd === 'string' ? /^(\d{4})-(\d{2})$/.exec(sd) : null;
      if (typeof sd !== 'string') out.shopDate.push({ level: 'error', code: 'SHOPDATE_FORMAT', msg: 'shopDate は "YYYY-MM-DD" または "YYYY-MM" で書いてください（「' + showVal(sd) + '」）' });
      else if (sd.trim() === '') out.shopDate.push({ level: 'error', code: 'SHOPDATE_EMPTY', msg: 'shopDate が空です。日付が未公表の場合は項目ごと削除してください' });
      else if (ym) {
        if (+ym[2] < 1 || +ym[2] > 12) out.shopDate.push({ level: 'error', code: 'SHOPDATE_INVALID', msg: 'shopDate：存在しない年月です（「' + sd + '」）' });
      } else if (YMD_RE.test(sd)) {
        if (!isRealYmd(sd)) out.shopDate.push({ level: 'error', code: 'SHOPDATE_INVALID', msg: 'shopDate：存在しない日付です（「' + sd + '」）' });
      } else {
        out.shopDate.push({ level: 'error', code: 'SHOPDATE_FORMAT', msg: 'shopDate の形式が正しくありません（「' + sd + '」）。"YYYY-MM-DD"（日まで判明）または "YYYY-MM"（年月だけ判明）で書いてください' });
      }
    }
    return out;
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
   * ctx: { path, isNew, now(Date|ms), skipBodyChecks, skipLastmodChecks, prevText }
   *   prevText … 更新時の既存ファイルの全文（投稿ツールが GitHub から取得したもの）。開催日の「変更していない項目」の判定に使う。
   *              CI は全記事を新規と同じ基準（isNew: true）で検証するため渡さない
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

    /* 開催日の形式・実在性（工程1a PR 1a-1）。
       エラーは「新規投稿」と「その項目を追加・変更した更新」に適用する。
       更新で値を変えていない項目は警告に下げる（続報の全文置換で、既存の値のせいに投稿が止まらないように）。
       更新前の内容（ctx.prevText）が無い・読めない場合は変更の有無を判定できないため、新規と同じく厳格に検証する */
    var prev = null;
    if (!isNew && typeof ctx.prevText === 'string') {
      var pfm = ctx.prevText.trim() ? parseFrontmatter(ctx.prevText) : null;
      if (pfm && pfm.ok) prev = pfm.data;
      else if (hasEvent || NEW_FIELDS.concat(EVENT_TEXT_FIELDS).some(function (f) { return d[f] !== undefined; })) add(warnings, 'EVENT_PREV_UNAVAILABLE', '既存記事の内容を読み取れなかったため、日付・店舗情報の項目（eventDate・eventDates・notableDate など）は新規入力として検証しました');
    }
    /* 新項目（工程1a PR 1a-2）も同じ方式: 追加・変更した項目だけエラー、変えていない項目は警告に下げる */
    var ev = checkEventFields(d);
    var nf = checkNewFields(d);
    NEW_FIELDS.forEach(function (f) { ev[f] = nf[f]; });
    /* 会場・主催者（工程1a PR 4）も同じ方式 */
    var tf = checkEventTextFields(d, fm.fmText);
    EVENT_TEXT_FIELDS.forEach(function (f) { ev[f] = tf[f]; });
    ['eventDate', 'eventDates', 'common'].concat(NEW_FIELDS, EVENT_TEXT_FIELDS).forEach(function (field) {
      var unchanged = field !== 'common' && prev && canonValue(prev[field]) === canonValue(d[field]);
      ev[field].forEach(function (x) {
        if (x.level === 'error' && unchanged) add(warnings, x.code, x.msg + '（既存の値で、今回の更新では変更されていないため投稿は止めません。修正を推奨します）');
        else add(x.level === 'error' ? errors : x.level === 'warning' ? warnings : info, x.code, x.msg);
      });
    });
    /* 店舗の状態の食い違い（警告だけ。工程1a PR 5） */
    checkShopConsistency(d, now, isNew, dp).forEach(function (x) { add(warnings, x.code, x.msg); });

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
    checkEventFields: checkEventFields,
    checkNewFields: checkNewFields,
    EVENT_KINDS: EVENT_KINDS,
    SHOP_STATUSES: SHOP_STATUSES,
    SHOP_STATUS_FROM: SHOP_STATUS_FROM,
    checkShopConsistency: checkShopConsistency,
    NEW_FIELDS: NEW_FIELDS,
    EVENT_TEXT_FIELDS: EVENT_TEXT_FIELDS,
    checkEventTextFields: checkEventTextFields,
    isRealYmd: isRealYmd,
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
