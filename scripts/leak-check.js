// 洩露檢查：Erin（公關專員）看得到的所有東西裡，限閱原話出現幾次。必須是 0。
//
//   node scripts/leak-check.js                       # 掃資料庫：Erin 的脈絡＋每份稿件所有審稿的遮蔽版
//   node scripts/leak-check.js --url http://localhost:3000/api/state?viewer=Erin
//                                                    # 另外掃網頁 API 回給 Erin 的 JSON（C 的伺服器）
//   node scripts/leak-check.js --viewer Erin         # 換人（預設 Erin）
//
// 限閱原話從資料庫取（restricted 脈絡的原話與它的來源訊息全文），不靠寫死。
// 結束碼：0＝沒洩露，1＝有洩露。資料庫：STICK_DB 或 ./stick.db

import { listDrafts, listReviews, getMessage } from '../src/db.js';
import { retrieveContext, redactReviewFor, clearanceOf } from '../src/access.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const viewer = opt('--viewer', 'Erin');
const url = opt('--url', null);

// 用看得到全部的人取出限閱內容（只用來比對，不輸出內容）
const auditor = 'Alice';
const restricted = retrieveContext(auditor).items.filter((i) => !clearanceOf(viewer).includes(i.sensitivity));
const needles = [...new Set(restricted.flatMap((i) => [i.source_quote, getMessage(i.source_message_id)?.text].filter(Boolean)))];

const surfaces = [];
surfaces.push({ name: `retrieveContext(${viewer})`, value: retrieveContext(viewer) });
for (const d of listDrafts()) {
  for (const r of listReviews(d.id)) {
    surfaces.push({ name: `review ${r.id} of draft ${d.id} (redacted for ${viewer})`, value: redactReviewFor(viewer, r) });
  }
}
if (url) {
  try {
    const res = await fetch(url);
    surfaces.push({ name: `GET ${url}`, value: await res.text() });
  } catch (e) {
    console.error(`could not fetch ${url}: ${e.message}`);
    process.exitCode = 2;
  }
}

let leaks = 0;
for (const s of surfaces) {
  const text = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
  const hits = needles.filter((n) => text.includes(n)).length;
  leaks += hits;
  console.log(`${hits === 0 ? 'ok  ' : 'LEAK'}  ${s.name}${hits ? `  (${hits} restricted quote(s))` : ''}`);
}

console.log(`\nviewer: ${viewer}  restricted items checked: ${restricted.length}  surfaces: ${surfaces.length}  leaks: ${leaks}`);
if (needles.length === 0) console.log('note: no restricted items in the database yet; run `npm run seed` first.');
if (leaks > 0) process.exitCode = 1;
