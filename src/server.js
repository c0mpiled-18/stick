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
import { reviewDraft, onContextAdded, staleDraftIds } from './review.js';

const PORT = Number(process.env.PORT) || 3000;
const PEOPLE = JSON.parse(readFileSync(new URL('../config/people.json', import.meta.url), 'utf8')).people;
const PAGE = new URL('../public/index.html', import.meta.url);

// 重審由誰觸發：機器人收到新訊息會自己叫 onContextAdded。這裡的輪詢是備援，
// 稿件「需重審」超過 GRACE 毫秒還沒人審才動手。沒有機器人（沒設 DISCORD_BOT_TOKEN）就立刻審。
const GRACE = Number(process.env.STICK_REREVIEW_GRACE_MS ?? (process.env.DISCORD_BOT_TOKEN ? 20_000 : 0));
const POLL_MS = 2_000;

const pending = new Set(); // 正在審的稿件 id
const errors = new Map(); // 稿件 id → 審稿失敗的訊息
const staleSince = new Map(); // 稿件 id → 第一次發現需重審的時間

function state(viewerInput) {
  const viewer = access.resolvePerson(viewerInput) ?? String(viewerInput ?? '');
  const drafts = db.listDrafts();
  const hasChild = new Set(drafts.map((d) => d.parent_id).filter((x) => x != null));
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
        stale: staleSince.has(d.id),
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

function submit({ viewer, text, withStick = true }) {
  const author = access.resolvePerson(viewer);
  if (!author) throw Object.assign(new Error('unknown person'), { status: 400 });
  const body = String(text ?? '').trim();
  if (!body) throw Object.assign(new Error('draft is empty'), { status: 400 });
  // 跟機器人一樣：同一個作者的上一份稿子當成前一版
  const prev = db.listDrafts().filter((d) => d.author === author).at(-1);
  const draftId = db.insertDraft({ author, title: prev?.title ?? body.slice(0, 40), text: body, parent_id: prev?.id ?? null });
  runReview(draftId, withStick !== false); // 不等它，網頁每秒更新會看到結果
  return { draftId };
}

async function pollStale() {
  try {
    const stale = new Set(await staleDraftIds());
    for (const id of staleSince.keys()) if (!stale.has(id)) staleSince.delete(id);
    const now = Date.now();
    for (const id of stale) if (!staleSince.has(id)) staleSince.set(id, now);

    const due = [...stale].filter((id) => now - staleSince.get(id) >= GRACE && !pending.has(id));
    if (due.length === 0) return;
    const events = db.listEvents(0);
    const ids = [...new Set(events.flatMap((e) => e.payload?.context_item_ids ?? (e.payload?.item_id != null ? [e.payload.item_id] : [])))];
    due.forEach((id) => pending.add(id));
    try {
      const redone = await onContextAdded({ context_item_ids: ids });
      if (redone.length) console.log(`[review] re-reviewed drafts: ${redone.join(', ')}`);
    } catch (e) {
      due.forEach((id) => errors.set(id, e.message));
      console.error(`[review] re-review failed: ${e.message}`);
    } finally {
      due.forEach((id) => pending.delete(id));
    }
  } catch (e) {
    console.error(`[poll] ${e.message}`);
  }
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

let timer = null;
let busy = false;
server.listen(PORT, () => {
  console.log(`[stick] http://localhost:${PORT}  (re-review grace ${GRACE} ms${process.env.ANTHROPIC_API_KEY ? '' : '; ANTHROPIC_API_KEY is not set, reviews will fail'})`);
  timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    await pollStale();
    busy = false;
  }, POLL_MS);
});

process.on('SIGINT', () => {
  clearInterval(timer);
  server.close(() => process.exit(0));
});
