// 有無 Stick 對照：同一份有問題的稿子（Erin 的 v1），各審 N 次，數兩個衝突都抓到的次數。
//
//   node --env-file=.env scripts/compare.js          # 預設各 5 次
//   node --env-file=.env scripts/compare.js --runs 3
//
// 用獨立的資料庫（預設 ./compare.db，每次重建），不會弄髒 demo 用的 stick.db。
// 需要 C 的 src/review.js：reviewDraft({ draftId, trigger, withStick }) → 審稿列。
//
// 「抓到」（docs/build-plan.md 第 6 節）：verdict 不是 ok；有一條問題引用 C1；有一條問題引用 C2 或 C3。

import { existsSync, rmSync } from 'node:fs';

const args = process.argv.slice(2);
const i = args.indexOf('--runs');
const runs = i >= 0 ? Number(args[i + 1]) : 5;

const path = process.env.COMPARE_DB || './compare.db';
for (const p of [path, `${path}-wal`, `${path}-shm`]) if (existsSync(p)) rmSync(p);
process.env.STICK_DB = path; // 一定要在載入 db.js 之前設

const db = await import('../src/db.js');
const { seedBase } = await import('./demo-data.js');
let reviewDraft;
try {
  ({ reviewDraft } = await import('../src/review.js'));
} catch (e) {
  console.error(`src/review.js not available yet (${e.code ?? e.message}). Merge C's branch first.`);
  process.exit(2);
}

// seedBase 需要一個 store 物件；用預設資料庫的函式組一個
const store = {
  insertMessage: db.insertMessage,
  insertContextItem: db.insertContextItem,
  insertEvent: db.insertEvent,
  insertDraft: db.insertDraft,
};
const { items, v1 } = seedBase(store);

const caught = (review) => {
  if (!review || review.verdict === 'ok') return false;
  const cites = (review.issues ?? []).map((x) => (x.cited_item_ids ?? []).map(Number));
  const date = cites.some((c) => c.includes(items.C1));
  const security = cites.some((c) => c.includes(items.C2) || c.includes(items.C3));
  return date && security;
};

const results = { without: [], with: [] };
for (const [label, withStick] of [['without', false], ['with', true]]) {
  for (let n = 1; n <= runs; n++) {
    let review;
    try {
      review = await reviewDraft({ draftId: v1, trigger: 'submitted', withStick });
    } catch (e) {
      console.log(`${label} #${n}: error ${e.message}`);
      results[label].push(false);
      continue;
    }
    const ok = caught(review);
    results[label].push(ok);
    console.log(`${label.padEnd(7)} #${n}: verdict=${review?.verdict} issues=${review?.issues?.length ?? 0} caught=${ok}`);
  }
}

const count = (a) => a.filter(Boolean).length;
console.log(`\nWithout Stick: ${count(results.without)} of ${runs} caught both issues.`);
console.log(`With Stick:    ${count(results.with)} of ${runs} caught both issues.`);
console.log(`(pass: with Stick >= ${Math.ceil(runs * 0.8)} of ${runs})`);
