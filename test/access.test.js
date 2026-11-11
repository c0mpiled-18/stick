import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/db.js';
import { createAccess, REDACTED_TEXT } from '../src/access.js';
import { MESSAGES, CONTEXT, DRAFTS, RESTRICTED_QUOTES } from '../scripts/demo-data.js';

function setup(keys = ['C1', 'C2', 'C3']) {
  const store = openStore(':memory:');
  const ids = {};
  for (const k of keys) {
    const m = store.insertMessage({ ...MESSAGES[k], url: `https://x/${k}` });
    ids[k] = store.insertContextItem({ ...CONTEXT[k], source_message_id: m });
  }
  return { store, ids, access: createAccess({ store }) };
}

const noLeak = (value) => {
  const s = JSON.stringify(value);
  for (const q of RESTRICTED_QUOTES) assert.ok(!s.includes(q), `leaked: ${q}`);
};

test('職位 × 等級', () => {
  const { access } = setup([]);
  const cases = {
    Erin: { public: true, internal: true, restricted: false },
    Alice: { public: true, internal: true, restricted: true },
    Ben: { public: true, internal: true, restricted: true },
    Dana: { public: true, internal: true, restricted: true },
    Stranger: { public: true, internal: false, restricted: false },
  };
  for (const [who, levels] of Object.entries(cases)) {
    for (const [level, ok] of Object.entries(levels)) {
      assert.equal(access.canSee(who, level), ok, `${who} ${level}`);
    }
  }
});

test('別名與大小寫都對得上；主管對照', () => {
  const { access } = setup([]);
  assert.equal(access.resolvePerson('erin'), 'Erin');
  assert.equal(access.getManager('Erin'), 'Alice');
  assert.equal(access.getManager('Alice'), null);
  assert.equal(access.getManager('nobody'), null);
  assert.equal(access.roleOf('Dana'), 'legal');
});

test('demo：Erin 拿到 1 條、Alice 拿到 3 條', () => {
  const { access } = setup();
  const erin = access.retrieveContext('Erin');
  const alice = access.retrieveContext('Alice');
  assert.equal(erin.items.length, 1);
  assert.equal(erin.excludedCount, 2);
  assert.equal(alice.items.length, 3);
  assert.equal(alice.excludedCount, 0);
  assert.equal(erin.items[0].source_quote, CONTEXT.C1.source_quote);
  assert.equal(erin.items[0].url, 'https://x/C1');
  noLeak(erin);
});

test('依主題過濾；excludedCount 只算符合主題的', () => {
  const { access } = setup();
  assert.deepEqual(access.retrieveContext('Alice', { topics: ['launch'] }).items.map((i) => i.topics), [['launch']]);
  const erinSec = access.retrieveContext('Erin', { topics: ['security'] });
  assert.equal(erinSec.items.length, 0);
  assert.equal(erinSec.excludedCount, 2);
  assert.equal(access.retrieveContext('Erin', { topics: ['launch'] }).excludedCount, 0);
});

test('sensitivityOfItems 取最高等級，不認得的 id 當成 restricted', () => {
  const { access, ids } = setup();
  assert.equal(access.sensitivityOfItems([ids.C1]), 'internal');
  assert.equal(access.sensitivityOfItems([ids.C1, ids.C2]), 'restricted');
  assert.equal(access.sensitivityOfItems([999]), 'restricted');
  assert.equal(access.sensitivityOfItems([]), 'public');
});

test('遮蔽：Erin 看得到日期那條，資安那條換成固定文字，脈絡包整包遮掉', () => {
  const { access, ids } = setup();
  const alicePacket = access.retrieveContext('Alice');
  const review = {
    id: 1, draft_id: 1, reviewer: 'Alice', verdict: 'block',
    context_packet: { viewer: 'Alice', items: alicePacket.items },
    issues: [
      { text: 'Launch date conflicts with Engineering.', suggestion: 'Say next Thursday.', cited_item_ids: [ids.C1], quote: CONTEXT.C1.source_quote },
      { text: 'Security claim conflicts with the incident.', suggestion: 'Remove the claim.', cited_item_ids: [ids.C2, ids.C3], quote: CONTEXT.C2.source_quote },
    ],
  };

  const forErin = access.redactReviewFor('Erin', review);
  assert.equal(forErin.issues.length, 2);
  assert.equal(forErin.issues[0].suggestion, 'Say next Thursday.');
  assert.equal(forErin.issues[0].sensitivity, 'internal');
  assert.deepEqual(forErin.issues[1], { text: REDACTED_TEXT, redacted: true });
  assert.deepEqual(forErin.context_packet, { redacted: true });
  assert.equal(forErin.verdict, 'block');
  noLeak(forErin);

  const forAlice = access.redactReviewFor('Alice', review);
  assert.equal(forAlice.issues[1].sensitivity, 'restricted');
  assert.deepEqual(forAlice.context_packet, review.context_packet);
});

test('遮蔽：問題沒有等級也沒有引用 → 當成 restricted', () => {
  const { access } = setup();
  const r = access.redactReviewFor('Erin', { issues: [{ text: 'something' }], context_packet: {} });
  assert.equal(r.issues[0].redacted, true);
  assert.equal(access.redactReviewFor('Erin', null), null);
});

test('demo 稿件存在', () => {
  assert.match(DRAFTS.v1.text, /never had a security incident/);
});
