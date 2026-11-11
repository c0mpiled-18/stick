import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/db.js';
import { createAccess } from '../src/access.js';
import { createReviewer } from '../src/review.js';
import { CONTEXT, DRAFTS, RESTRICTED_QUOTES, seedBase, addConversation } from '../scripts/demo-data.js';

function setup(fakeModel) {
  const store = openStore(':memory:');
  const { items, v1 } = seedBase(store);
  const access = createAccess({ store });
  const calls = [];
  const callModel = async (req) => {
    calls.push(req);
    return fakeModel(req, items);
  };
  return { store, items, v1, access, calls, rv: createReviewer({ store, access, callModel }) };
}

// 模擬一個「好」的模型：日期一條、資安一條
const goodModel = (_req, items) => ({
  verdict: 'block',
  issues: [
    { text: 'Launch date conflicts with Engineering.', suggestion: 'Say next Thursday.', cited_item_ids: [items.C1], quote: 'slips to next Thursday' },
    { text: 'Security claim conflicts with the incident and Legal.', suggestion: 'Remove the claim.', cited_item_ids: [items.C2, items.C3], quote: CONTEXT.C3.source_quote },
  ],
});

test('有 Stick：用主管 Alice 的權限，脈絡包有 3 條，兩條問題都留下並標等級', async () => {
  const { rv, v1, calls, store } = setup(goodModel);
  const r = await rv.reviewDraft({ draftId: v1 });
  assert.equal(r.reviewer, 'Alice');
  assert.equal(r.verdict, 'block');
  assert.equal(r.context_packet.items.length, 3);
  assert.equal(r.issues.length, 2);
  assert.deepEqual(r.issues.map((i) => i.sensitivity), ['internal', 'restricted']);
  assert.ok(r.packet_hash);
  assert.match(calls[0].user, /Smart Export slips to next Thursday/);
  assert.equal(store.listReviews(v1).length, 1);
});

test('沒有 Stick：模型看不到任何內部脈絡', async () => {
  const { rv, v1, calls } = setup(() => ({ verdict: 'ok', issues: [] }));
  const r = await rv.reviewDraft({ draftId: v1, withStick: false });
  assert.match(calls[0].user, /\(no internal context\)/);
  for (const q of RESTRICTED_QUOTES) assert.ok(!calls[0].user.includes(q));
  assert.equal(r.verdict, 'ok');
  assert.equal(r.with_stick, false);
});

test('不信模型自述：非逐字原話、引用不存在的 id、沒引用的問題都丟掉；剩 0 條就改判 ok', async () => {
  const { rv, v1 } = setup((_r, items) => ({
    verdict: 'block',
    issues: [
      { text: 'a', suggestion: 'a', cited_item_ids: [items.C1], quote: 'launch is delayed' },
      { text: 'b', suggestion: 'b', cited_item_ids: [999], quote: 'x' },
      { text: 'c', suggestion: 'c', cited_item_ids: [], quote: '' },
    ],
  }));
  const r = await rv.reviewDraft({ draftId: v1 });
  assert.equal(r.issues.length, 0);
  assert.equal(r.verdict, 'ok');
});

test('模型說 ok 卻列了有依據的問題 → needs_change', async () => {
  const { rv, v1 } = setup((_r, items) => ({ verdict: 'ok', issues: [{ text: 'date', suggestion: 's', cited_item_ids: [items.C1], quote: 'next Thursday' }] }));
  assert.equal((await rv.reviewDraft({ draftId: v1 })).verdict, 'needs_change');
});

test('遮蔽：Erin 看到的審稿沒有任何限閱原話', async () => {
  const { rv, v1, access } = setup(goodModel);
  const r = await rv.reviewDraft({ draftId: v1 });
  const forErin = access.redactReviewFor('Erin', r);
  const s = JSON.stringify(forErin);
  for (const q of RESTRICTED_QUOTES) assert.ok(!s.includes(q), q);
  assert.equal(forErin.issues[0].suggestion, 'Say next Thursday.');
  assert.equal(forErin.issues[1].redacted, true);
});

test('重審：v2 過審後，C4（又延一週）進來 → v2 被重審；v1 不重審（有新版）', async () => {
  let phase = 'v2-ok';
  const { rv, store, v1 } = setup((_req, items) => {
    if (phase === 'v2-ok') return { verdict: 'ok', issues: [] };
    const c4 = Math.max(...Object.values(items)) + 1;
    return { verdict: 'needs_change', issues: [{ text: 'Date slipped again.', suggestion: 'Drop the date.', cited_item_ids: [c4], quote: 'slips another week' }] };
  });
  const v2 = store.insertDraft({ ...DRAFTS.v2, parent_id: v1 });
  await rv.reviewDraft({ draftId: v1 });
  await rv.reviewDraft({ draftId: v2 });
  assert.equal(store.latestReview(v2).verdict, 'ok');

  phase = 'after-c4';
  const before = store.listEvents(0).at(-1).id;
  addConversation(store, 'C4');
  const [event] = store.listEvents(before);
  const ids = await rv.onContextAdded(event);
  assert.deepEqual(ids, [v2]);
  const r = store.latestReview(v2);
  assert.equal(r.trigger, 'context_added');
  assert.equal(r.verdict, 'needs_change');
});

test('重審：被擋下（block）的稿件、沒用 Stick 審的稿件不自動重審', async () => {
  const { rv, store, v1 } = setup(goodModel);
  await rv.reviewDraft({ draftId: v1 });
  const before = store.listEvents(0).at(-1).id;
  addConversation(store, 'C4');
  const [event] = store.listEvents(before);
  assert.deepEqual(await rv.onContextAdded(event), []);
});

test('稿件不存在 → 丟錯', async () => {
  const { rv } = setup(goodModel);
  await assert.rejects(() => rv.reviewDraft({ draftId: 42 }), /does not exist/);
});
