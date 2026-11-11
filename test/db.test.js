import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/db.js';

const fresh = () => openStore(':memory:');
const msg = (db, text = 'Heads up: Smart Export slips to next Thursday. QA found a sync bug.') =>
  db.insertMessage({ channel: 'eng-general', author: 'Ben', role: 'engineering', text, url: 'https://discord.com/x' });

test('五張表建得起來，寫入回傳遞增的 id', () => {
  const db = fresh();
  assert.equal(msg(db), 1);
  assert.equal(msg(db), 2);
  assert.equal(db.listMessages().length, 2);
});

test('只增不改：UPDATE 與 DELETE 都被擋', () => {
  const db = fresh();
  const m = msg(db);
  db.insertContextItem({ summary: 's', sensitivity: 'internal', source_message_id: m, source_quote: 'QA' });
  const d = db.insertDraft({ author: 'Erin', text: 'v1' });
  db.insertReview({ draft_id: d, reviewer: 'Alice', trigger: 'submitted', with_stick: true, verdict: 'ok' });
  db.insertEvent({ type: 'context_added' });
  assert.throws(() => db.db.exec("UPDATE messages SET text = 'x'"), /append-only/);
  assert.throws(() => db.db.exec('DELETE FROM messages'), /append-only/);
  for (const t of ['context_items', 'drafts', 'reviews', 'events']) {
    assert.throws(() => db.db.exec(`DELETE FROM ${t}`), /append-only/, t);
  }
});

test('沒有提供改或刪的函式', () => {
  const names = Object.keys(fresh());
  assert.ok(!names.some((n) => /update|delete|remove|set/i.test(n)), names.join(','));
});

test('固定值以外的值會被擋', () => {
  const db = fresh();
  assert.throws(() => db.insertMessage({ channel: 'c', author: 'a', role: 'ceo', text: 't' }), /role/);
  assert.throws(() => db.insertMessage({ source: 'teams', channel: 'c', author: 'a', role: 'bot', text: 't' }), /source/);
  const m = msg(db);
  assert.throws(() => db.insertContextItem({ summary: 's', sensitivity: 'secret', source_message_id: m, source_quote: 'QA' }), /sensitivity/);
});

test('脈絡的原話必須是來源訊息的逐字片段', () => {
  const db = fresh();
  const m = msg(db);
  const id = db.insertContextItem({ summary: 'Launch slips', topics: ['launch'], sensitivity: 'internal', source_message_id: m, source_quote: 'Smart Export slips to next Thursday' });
  assert.equal(id, 1);
  assert.throws(
    () => db.insertContextItem({ summary: 'x', topics: [], sensitivity: 'internal', source_message_id: m, source_quote: 'Smart Export is delayed' }),
    /verbatim/,
  );
  assert.throws(() => db.insertContextItem({ summary: 'x', sensitivity: 'internal', source_message_id: 99, source_quote: 'x' }), /does not exist/);
  assert.deepEqual(db.listContextItems()[0].topics, ['launch']);
});

test('稿件版次：給 parent_id 就自動 +1', () => {
  const db = fresh();
  const v1 = db.insertDraft({ author: 'Erin', title: 'Smart Export', text: 'v1' });
  const v2 = db.insertDraft({ author: 'Erin', title: 'Smart Export', text: 'v2', parent_id: v1 });
  assert.equal(db.getDraft(v1).revision, 1);
  assert.equal(db.getDraft(v2).revision, 2);
  assert.equal(db.getDraft(v2).parent_id, v1);
  assert.equal(db.listDrafts().length, 2);
});

test('審稿：latestReview 拿最新一筆，JSON 欄位與布林還原', () => {
  const db = fresh();
  const d = db.insertDraft({ author: 'Erin', text: 'v1' });
  assert.equal(db.latestReview(d), null);
  db.insertReview({ draft_id: d, reviewer: 'Alice', trigger: 'submitted', with_stick: true, context_packet: { items: [1] }, packet_hash: 'h', verdict: 'block', issues: [{ text: 'date', cited_item_ids: [1], sensitivity: 'internal' }] });
  db.insertReview({ draft_id: d, reviewer: 'Alice', trigger: 'context_added', with_stick: true, context_packet: {}, verdict: 'ok', issues: [] });
  const r = db.latestReview(d);
  assert.equal(r.verdict, 'ok');
  assert.equal(r.trigger, 'context_added');
  assert.equal(r.with_stick, true);
  assert.deepEqual(db.listReviews(d)[0].issues[0].cited_item_ids, [1]);
  assert.deepEqual(db.listReviews(d)[0].context_packet, { items: [1] });
  assert.throws(() => db.insertReview({ draft_id: d, reviewer: 'A', trigger: 'submitted', with_stick: true, verdict: 'maybe' }), /verdict/);
});

test('事件：listEvents(sinceId) 只回傳之後的', () => {
  const db = fresh();
  const a = db.insertEvent({ type: 'context_added', payload: { item_id: 1, topics: ['launch'] } });
  db.insertEvent({ type: 'context_added', payload: { item_id: 2, topics: ['security'] } });
  assert.equal(db.listEvents().length, 2);
  const later = db.listEvents(a);
  assert.equal(later.length, 1);
  assert.deepEqual(later[0].payload.topics, ['security']);
  assert.throws(() => db.insertEvent({ type: 'other' }), /eventType/);
});
