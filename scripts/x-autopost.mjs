// 新着 posts 記事を X(旧Twitter) に自動ポストする。
// GitHub Actions（deploy 完了後）から実行。X の APIキー4種が env に無ければ安全に no-op で終了。
// 状態は .github/x-posted.json（ポスト済み guid の配列）で管理し、ワークフローが [skip ci] でコミットする。
//
// 動作方針:
//  - ソースは公開済み RSS（/posts/index.xml）＝予約公開された記事も確実に拾える
//  - 初回（状態が空）は「今ある記事を全部ポスト済みとして記録し、投稿は0件」＝過去記事の一斉投稿を防ぐ
//  - 以降は未ポストの新着を古い順に最大 MAX_PER_RUN 件まで投稿
//
// 必要な Secrets（GitHub リポジトリ Settings → Secrets and variables → Actions）:
//   X_APP_KEY / X_APP_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const FEED_URL = 'https://urayasu-portal.com/posts/index.xml';
const STATE_PATH = '.github/x-posted.json';
const MAX_PER_RUN = Number(process.env.X_MAX_PER_RUN || 3);
const STATE_CAP = 800; // 状態ファイルに保持する guid の上限
const HASHTAGS = '#浦安 #浦安ぽーたる';

const creds = {
  appKey: process.env.X_APP_KEY,
  appSecret: process.env.X_APP_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
};

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function parseFeed(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const grab = (tag) => {
      const mm = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(block);
      return mm ? decodeEntities(mm[1]) : '';
    };
    const link = grab('link');
    const guid = grab('guid') || link;
    const title = grab('title');
    if (link && title) items.push({ guid, title, link });
  }
  return items; // RSS は新しい順
}

function loadState() {
  if (!existsSync(STATE_PATH)) return { posted: [] };
  try {
    const j = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    return { posted: Array.isArray(j.posted) ? j.posted : [] };
  } catch {
    return { posted: [] };
  }
}

function saveState(posted) {
  const trimmed = posted.slice(-STATE_CAP);
  writeFileSync(STATE_PATH, JSON.stringify({ posted: trimmed }, null, 2) + '\n');
}

function buildText(item) {
  // X の文字数は URL=23、CJK=2幅換算・上限280幅。タイトルは十分短いので素直に組む。
  let title = item.title;
  if (title.length > 90) title = title.slice(0, 89) + '…';
  return `【新着】${title}\n${item.link}\n${HASHTAGS}`;
}

async function main() {
  const missing = Object.entries(creds).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.log(`[x-autopost] no-op: X API secrets 未設定 (${missing.join(', ')})`);
    return;
  }

  const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'urayasu-portal-x-autopost' } });
  if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
  const items = parseFeed(await res.text());
  if (!items.length) {
    console.log('[x-autopost] feed に item なし。終了。');
    return;
  }

  const state = loadState();
  const postedSet = new Set(state.posted);

  const { TwitterApi } = await import('twitter-api-v2');
  const rw = new TwitterApi(creds).readWrite;

  async function post(item) {
    try {
      await rw.v2.tweet(buildText(item));
      console.log(`[x-autopost] posted: ${item.title}`);
      return true;
    } catch (e) {
      console.error(`[x-autopost] 投稿失敗（スキップ）: ${item.title} :: ${e?.message || e}`);
      return false;
    }
  }

  // 初回：最新1件だけ投稿し、残りを既読化（過去記事の一斉投稿を防ぎつつ、稼働確認を兼ねる）。
  // 投稿失敗（キー不正等）時は最新を既読化せず次回リトライさせる。
  if (state.posted.length === 0) {
    const newest = items[0];
    const ok = await post(newest);
    const seed = items.map((i) => i.guid).filter((g) => ok || g !== newest.guid);
    saveState(seed);
    console.log(`[x-autopost] 初回: 最新1件を${ok ? '投稿' : '投稿失敗(次回リトライ)'}、既読化 ${seed.length}件。`);
    return;
  }

  const fresh = items.filter((i) => !postedSet.has(i.guid)).reverse(); // 古い順
  if (!fresh.length) {
    console.log('[x-autopost] 新着なし。');
    return;
  }

  const toPost = fresh.slice(0, MAX_PER_RUN);
  for (const item of toPost) {
    if (await post(item)) postedSet.add(item.guid);
  }
  if (fresh.length > MAX_PER_RUN) {
    console.log(`[x-autopost] 残り${fresh.length - MAX_PER_RUN}件は次回に持ち越し。`);
  }

  // 既読集合を保存（元の順序を保ちつつ、投稿できた分だけ末尾へ）
  const merged = state.posted.concat(toPost.filter((i) => postedSet.has(i.guid)).map((i) => i.guid));
  saveState(merged);
  console.log('[x-autopost] 完了。');
}

main().catch((e) => {
  console.error('[x-autopost] エラー:', e?.message || e);
  process.exit(1);
});
