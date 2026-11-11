// 網頁伺服器（C，ryan）：一頁唯讀畫面加一個交稿框。不用任何套件。
// 執行：npm run server（＝node --env-file=.env src/server.js），開 http://localhost:3000
//
//   GET  /                         網頁
//   GET  /api/state?viewer=Erin    這個人看得到的全部：脈絡、稿件、審稿結果
//   POST /api/review               { viewer, text, withStick } 交稿並審稿（Discord 的 !review 的備援）
//
// 規矩：回給 viewer 的每一樣東西都先過權限層。
//   脈絡 → retrieveContext(viewer)；審稿結果 → redactReviewFor(viewer, review)。
//   這個檔案不直接讀 context_items。

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import * as db from './db.js';
import * as access from './access.js';
import { reviewDraft, startReReviewLoop } from './review.js'; // antonshuo 寫的審稿層

const PORT = Number(process.env.PORT) || 3000;
const PEOPLE = JSON.parse(readFileSync(new URL('../config/people.json', import.meta.url), 'utf8')).people;
const PAGE = new URL('../public/index.html', import.meta.url);

// 重審只能有一個人觸發（STATUS「卡住」20:40）：預設由機器人在收到新訊息時觸發，這裡不重審。
// 沒有機器人、只用 seed 假資料開發時，用 STICK_REREVIEW=1 npm run server 讓伺服器自己掃 events。
const REREVIEW = process.env.STICK_REREVIEW === '1';

const pending = new Set(); // 正在審的稿件 id
const errors = new Map(); // 稿件 id → 審稿失敗的訊息

/**
 * 「需重審」：最新版、用 Stick 審過、沒被擋下，而主管現在看得到的脈絡比上次審的時候多。
 * 只回傳稿件 id，不帶任何脈絡內容；脈絡照樣經 retrieveContext 拿。
 */
function staleIds(drafts, hasChild) {
  const out = new Set();
  for (const d of drafts) {
    if (hasChild.has(d.id)) continue;
    const last = db.latestReview(d.id);
    if (!last || !last.with_stick || last.verdict === 'block') continue;
    const seen = new Set((last.context_packet?.items ?? []).map((i) => Number(i.id)));
    if (access.retrieveContext(last.reviewer).items.some((i) => !seen.has(Number(i.id)))) out.add(d.id);
  }
  return out;
}

function state(viewerInput) {
  const viewer = access.resolvePerson(viewerInput) ?? String(viewerInput ?? '');
  const drafts = db.listDrafts();
  const hasChild = new Set(drafts.map((d) => d.parent_id).filter((x) => x != null));
  const stale = staleIds(drafts, hasChild);
  return {
    viewer,
    role: access.roleOf(viewer),
    clearance: access.clearanceOf(viewer),
    people: Object.entries(PEOPLE).map(([name, p]) => ({ name, role: p.role, manager: p.manager ?? null })),
    context: access.retrieveContext(viewer),
    drafts: drafts
      .map((d) => ({
        ...d,
        latest: !hasChild.has(d.id),
        reviewing: pending.has(d.id),
        stale: stale.has(d.id),
        error: errors.get(d.id) ?? null,
        reviews: db.listReviews(d.id).map((r) => mergeRedacted(access.redactReviewFor(viewer, r))),
      }))
      .reverse(),
  };
}

// 被遮蔽的問題只留一條：不讓人從條數猜出有幾件事
function mergeRedacted(review) {
  let kept = false;
  const issues = review.issues.filter((i) => !i.redacted || (!kept && (kept = true)));
  return { ...review, issues };
}

async function runReview(draftId, withStick) {
  pending.add(draftId);
  errors.delete(draftId);
  try {
    await reviewDraft({ draftId, trigger: 'submitted', withStick });
  } catch (e) {
    errors.set(draftId, e.message);
    console.error(`[review] draft ${draftId} failed: ${e.message}`);
  } finally {
    pending.delete(draftId);
  }
}

function submit(body) {
  // 內容不是物件（例如 null、陣列、字串）一律當成格式錯誤
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('body must be a JSON object'), { status: 400 });
  const { viewer, text, withStick = true } = body;
  const author = access.resolvePerson(viewer);
  if (!author) throw Object.assign(new Error('unknown person'), { status: 400 });
  const draftText = String(text ?? '').trim();
  if (!draftText) throw Object.assign(new Error('draft is empty'), { status: 400 });
  // 跟機器人一樣：同一個作者的上一份稿子當成前一版
  const prev = db.listDrafts().filter((d) => d.author === author).at(-1);
  const draftId = db.insertDraft({ author, title: prev?.title ?? draftText.slice(0, 40), text: draftText, parent_id: prev?.id ?? null });
  runReview(draftId, withStick !== false); // 不等它，網頁每秒更新會看到結果
  return { draftId };
}

const json = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 100_000) reject(Object.assign(new Error('too large'), { status: 413 }));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(Object.assign(new Error('invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(readFileSync(PAGE));
    }
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, state(url.searchParams.get('viewer')));
    if (req.method === 'POST' && url.pathname === '/api/review') return json(res, 202, submit(await readBody(req)));
    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, e.status ?? 500, { error: e.message });
  }
});

let stopLoop = null;
server.listen(PORT, () => {
  console.log(`[stick] http://localhost:${PORT}${REREVIEW ? '  (re-reviewing on new context)' : ''}${process.env.ANTHROPIC_API_KEY ? '' : '  ANTHROPIC_API_KEY is not set, reviews will fail'}`);
  if (REREVIEW) stopLoop = startReReviewLoop({ intervalMs: 2000, onReReviewed: (ids) => console.log(`[review] re-reviewed drafts: ${ids.join(', ')}`) });
});

process.on('SIGINT', () => {
  stopLoop?.();
  server.close(() => process.exit(0));
});
