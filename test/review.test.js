import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/db.js';
import { createAccess, REDACTED_TEXT } from '../src/access.js';
import { createReviewer, verbatim } from '../src/review.js';
import { MESSAGES, CONTEXT, DRAFTS, RESTRICTED_QUOTES } from '../scripts/demo-data.js';

function setup({ keys = ['C1', 'C2', 'C3'], model } = {}) {
  const store = openStore(':memory:');
  const ids = {};
  const add = (k) => {
    const m = store.insertMessage({ ...MESSAGES[k], url: `https://x/${k}` });
    ids[k] = store.insertContextItem({ ...CONTEXT[k], source_message_id: m });
    return ids[k];
  };
  keys.forEach(add);
  const access = createAccess({ store });
  const calls = [];
  const fake = async (input) => {
    calls.push(input);
    return model(input, ids);
  };
  return { store, ids, add, access, calls, reviewer: createReviewer({ store, access, model: fake }) };
}

const noLeak = (value) => {
  const s = JSON.stringify(value);
  for (const q of RESTRICTED_QUOTES) assert.ok(!s.includes(q), `leaked: ${q}`);
};

// 一個「好」的模型回答：日期衝突引用 C1，資安衝突引用 C2、C3
const goodAnswer = (_input, ids) => ({
  draft_topics: ['launch', 'security'],
  issues: [
    {
      text: 'The draft says the launch is tomorrow, but it has slipped.',
      suggestion: 'Change the date to next Thursday.',
      quotes: [{ item_id: ids.C1, quote: 'Smart Export slips to next Thursday' }],
    },
    {
      text: 'The draft claims there has never been a security incident.',
      suggestion: 'Remove the sentence.',
      quotes: [
        { item_id: ids.C2, quote: "exposed some users' email addresses" },
        { item_id: ids.C3, quote: 'No public statements about security or data safety' },
      ],
    },
  ],
});

test('verbatim：逐字片段才算；彎引號視同直引號；太短不算', () => {
  const src = "The export API exposed some users' email addresses for about two hours yesterday";
  assert.equal(verbatim("exposed some users' email addresses", src), "exposed some users' email addresses");
  assert.equal(verbatim('exposed some users’ email addresses', src), "exposed some users' email addresses");
  assert.equal(verbatim('"exposed some users\' email addresses"', src), "exposed some users' email addresses");
  assert.equal(verbatim('exposed many users email addresses', src), null);
  assert.equal(verbatim('The', src), null);
  assert.equal(verbatim('', src), null);
});

test('v1 有 Stick：用主管 Alice 的權限，兩個衝突都抓到，結論是 block', async () => {
  const { store, ids, reviewer, calls } = setup({ model: goodAnswer });
  const v1 = store.insertDraft(DRAFTS.v1);
  const review = await reviewer.reviewDraft({ draftId: v1, trigger: 'submitted', withStick: true });

  assert.equal(review.reviewer, 'Alice');
  assert.equal(review.with_stick, true);
  assert.equal(review.trigger, 'submitted');
  assert.equal(review.verdict, 'block');
  assert.equal(review.issues.length, 2);
  assert.deepEqual(review.issues[0].cited_item_ids, [ids.C1]);
  assert.equal(review.issues[0].sensitivity, 'internal');
  assert.deepEqual(review.issues[1].cited_item_ids, [ids.C2, ids.C3]);
  assert.equal(review.issues[1].sensitivity, 'restricted');
  assert.equal(review.issues[0].quotes[0].url, 'https://x/C1');
  assert.equal(review.issues[0].quotes[0].author, 'Ben');

  // 脈絡包：三條都帶入，原樣存檔，有指紋，模型看到的就是這一包
  assert.equal(review.context_packet.items.length, 3);
  assert.equal(review.context_packet.excluded_count, 0);
  assert.deepEqual(review.context_packet.draft_topics, ['launch', 'security']);
  assert.match(review.packet_hash, /^[0-9a-f]{64}$/);
  assert.equal(calls[0].packet.items.length, 3);
  assert.deepEqual(store.latestReview(v1), review);
});

test('遮蔽：Erin 看得到日期那條，資安那條換成固定文字，限閱原話 0 次', async () => {
  const { store, ids, reviewer, access } = setup({ model: goodAnswer });
  const v1 = store.insertDraft(DRAFTS.v1);
  const review = await reviewer.reviewDraft({ draftId: v1 });
  const forErin = access.redactReviewFor('Erin', review);

  assert.equal(forErin.verdict, 'block');
  assert.deepEqual(forErin.issues[0].cited_item_ids, [ids.C1]);
  assert.deepEqual(forErin.issues[1], { text: REDACTED_TEXT, redacted: true });
  assert.deepEqual(forErin.context_packet, { redacted: true });
  noLeak(forErin);

  // Alice 看得到全部
  assert.equal(access.redactReviewFor('Alice', review).issues[1].quotes.length, 2);
});

test('沒有 Stick：脈絡包是空的，模型拿不到任何脈絡', async () => {
  const { store, reviewer, calls } = setup({ model: async () => ({ draft_topics: ['launch'], issues: [] }) });
  const v1 = store.insertDraft(DRAFTS.v1);
  const review = await reviewer.reviewDraft({ draftId: v1, withStick: false });

  assert.equal(review.with_stick, false);
  assert.equal(review.verdict, 'ok');
  assert.deepEqual(review.context_packet.items, []);
  assert.deepEqual(calls[0].packet.items, []);
  noLeak(calls[0]);
});

test('沒有 Stick 時模型自己挑的問題：留著，但沒有引用、等級是 public', async () => {
  const { store, reviewer } = setup({
    model: async () => ({ draft_topics: [], issues: [{ text: 'Absolute claim.', suggestion: 'Soften it.', quotes: [] }] }),
  });
  const review = await reviewer.reviewDraft({ draftId: store.insertDraft(DRAFTS.v1), withStick: false });
  assert.equal(review.verdict, 'needs_change');
  assert.deepEqual(review.issues, [{ text: 'Absolute claim.', suggestion: 'Soften it.', cited_item_ids: [], sensitivity: 'public', quotes: [] }]);
});

test('引用對不上就丟；沒有任何有效引用的問題整條丟掉', async () => {
  const { store, ids, reviewer } = setup({
    model: async (_i, ids) => ({
      draft_topics: ['launch'],
      issues: [
        { text: 'Made-up quote.', suggestion: 'x', quotes: [{ item_id: ids.C1, quote: 'Smart Export slips to next Friday' }] },
        { text: 'No source at all.', suggestion: 'x', quotes: [] },
        { text: 'Unknown item.', suggestion: 'x', quotes: [{ item_id: 999, quote: 'Smart Export slips to next Thursday' }] },
        {
          text: 'Date is wrong.',
          suggestion: 'Fix the date.',
          quotes: [
            { item_id: ids.C1, quote: 'slips to next Thursday' },
            { item_id: ids.C1, quote: 'something the model invented' },
          ],
        },
      ],
    }),
  });
  const review = await reviewer.reviewDraft({ draftId: store.insertDraft(DRAFTS.v1) });
  assert.equal(review.issues.length, 1);
  assert.equal(review.issues[0].text, 'Date is wrong.');
  assert.deepEqual(review.issues[0].quotes.map((q) => q.quote), ['slips to next Thursday']);
  assert.deepEqual(review.issues[0].cited_item_ids, [ids.C1]);
  assert.equal(review.verdict, 'needs_change'); // 只有 internal 的問題：要修改，不擋
});

test('標等級寧可標高：聲稱用到限閱脈絡但引用對不上、或文字夾帶限閱原話，都算 restricted', async () => {
  const { store, ids, reviewer, access } = setup({
    model: async (_i, ids) => ({
      draft_topics: ['launch'],
      issues: [
        {
          text: 'Date is wrong.',
          suggestion: 'Fix it.',
          quotes: [
            { item_id: ids.C1, quote: 'Smart Export slips to next Thursday' },
            { item_id: ids.C2, quote: 'a paraphrase that is not verbatim' },
          ],
        },
        {
          text: `Date is wrong. Also: ${CONTEXT.C3.source_quote}.`,
          suggestion: 'Fix it.',
          quotes: [{ item_id: ids.C1, quote: 'Smart Export slips to next Thursday' }],
        },
      ],
    }),
  });
  const review = await reviewer.reviewDraft({ draftId: store.insertDraft(DRAFTS.v1) });
  assert.deepEqual(review.issues.map((i) => i.sensitivity), ['restricted', 'restricted']);
  assert.deepEqual(review.issues[0].cited_item_ids, [ids.C1]);
  assert.equal(review.verdict, 'block');
  noLeak(access.redactReviewFor('Erin', review));
});

test('沒登記的作者：沒有主管、只看得到 public，不會拿到內部脈絡', async () => {
  const { store, reviewer, calls } = setup({ model: async () => ({ draft_topics: [], issues: [] }) });
  const id = store.insertDraft({ author: 'stranger', text: 'Hello.' });
  const review = await reviewer.reviewDraft({ draftId: id });
  assert.equal(review.reviewer, 'stranger');
  assert.deepEqual(calls[0].packet.items, []);
  assert.equal(review.context_packet.excluded_count, 3);
});

test('稿件不存在就丟錯', async () => {
  const { reviewer } = setup({ model: goodAnswer });
  await assert.rejects(() => reviewer.reviewDraft({ draftId: 42 }), /does not exist/);
});

// ---- 重審 ----

// v2 的模型：脈絡裡有 C4（又延一週）才挑出日期問題
const v2Answer = ({ packet }, ids) => {
  const c4 = packet.items.find((i) => i.id === ids.C4);
  return {
    draft_topics: ['launch'],
    issues: c4
      ? [{ text: 'Launch slipped again.', suggestion: 'Update the date.', quotes: [{ item_id: c4.id, quote: 'Smart Export slips another week' }] }]
      : [],
  };
};

function seedV2(ctx) {
  const v1 = ctx.store.insertDraft(DRAFTS.v1);
  const v2 = ctx.store.insertDraft({ ...DRAFTS.v2, parent_id: v1 });
  return { v1, v2 };
}

test('重審：v2 過審後 C4 進來，v2 被改判 needs_change 並引用 C4；同一事件再來一次不重複審', async () => {
  const ctx = setup({ model: v2Answer });
  const { v1, v2 } = seedV2(ctx);
  assert.equal((await ctx.reviewer.reviewDraft({ draftId: v2 })).verdict, 'ok');

  const c4 = ctx.add('C4');
  const event = { id: 9, type: 'context_added', payload: { context_item_ids: [c4], topics: ['launch'], message_id: 4 } };
  assert.deepEqual(await ctx.reviewer.onContextAdded(event), [v2]);

  const latest = ctx.store.latestReview(v2);
  assert.equal(latest.trigger, 'context_added');
  assert.equal(latest.verdict, 'needs_change');
  assert.deepEqual(latest.issues[0].cited_item_ids, [c4]);
  assert.equal(ctx.store.listReviews(v1).length, 0); // 舊版不重審

  assert.deepEqual(await ctx.reviewer.onContextAdded(event), []);
  assert.equal(ctx.store.listReviews(v2).length, 2);
});

test('重審：機器人直接給 { context_item_ids }（沒有 topics）與舊格式 { item_id } 都收', async () => {
  for (const shape of [(id) => ({ type: 'context_added', context_item_ids: [id] }), (id) => ({ payload: { item_id: id, topics: ['launch'] } })]) {
    const ctx = setup({ model: v2Answer });
    const { v2 } = seedV2(ctx);
    await ctx.reviewer.reviewDraft({ draftId: v2 });
    assert.deepEqual(await ctx.reviewer.onContextAdded(shape(ctx.add('C4'))), [v2]);
  }
});

test('重審：主題不相關的不審；已擋下的不審；只用無 Stick 審過的不審；空事件不審', async () => {
  // 主題不相關：稿件談 launch，新脈絡是 security
  const a = setup({ keys: ['C1'], model: async () => ({ draft_topics: ['launch'], issues: [] }) });
  const { v2 } = seedV2(a);
  await a.reviewer.reviewDraft({ draftId: v2 });
  assert.deepEqual(await a.reviewer.onContextAdded({ payload: { context_item_ids: [a.add('C2')], topics: ['security'] } }), []);

  // 已擋下
  const b = setup({ model: goodAnswer });
  const v1 = b.store.insertDraft(DRAFTS.v1);
  await b.reviewer.reviewDraft({ draftId: v1 });
  assert.deepEqual(await b.reviewer.onContextAdded({ payload: { context_item_ids: [b.add('C4')], topics: ['launch'] } }), []);

  // 只有 Before（無 Stick）的審稿
  const c = setup({ model: async () => ({ draft_topics: ['launch'], issues: [] }) });
  const d = c.store.insertDraft(DRAFTS.v2);
  await c.reviewer.reviewDraft({ draftId: d, withStick: false });
  assert.deepEqual(await c.reviewer.onContextAdded({ payload: { context_item_ids: [c.add('C4')], topics: ['launch'] } }), []);

  assert.deepEqual(await c.reviewer.onContextAdded({ payload: {} }), []);
  assert.deepEqual(await c.reviewer.onContextAdded(null), []);
});

test('staleDraftIds：新脈絡進來到重審完成之間，稿件被標成需重審', async () => {
  const ctx = setup({ model: v2Answer });
  const { v2 } = seedV2(ctx);
  await ctx.reviewer.reviewDraft({ draftId: v2 });
  assert.deepEqual(await ctx.reviewer.staleDraftIds(), []);
  const c4 = ctx.add('C4');
  assert.deepEqual(await ctx.reviewer.staleDraftIds(), [v2]);
  await ctx.reviewer.onContextAdded({ context_item_ids: [c4] });
  assert.deepEqual(await ctx.reviewer.staleDraftIds(), []);
});
