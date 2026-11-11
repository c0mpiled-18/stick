import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingestMessage, maxSensitivity } from '../src/ingest.js';
import { normalize, resolveChannel } from '../src/sources/discord.js';

const fakeDb = () => {
  const rows = { messages: [], items: [], events: [] };
  return {
    rows,
    insertMessage: (r) => rows.messages.push(r),
    insertContextItem: (r) => rows.items.push(r),
    insertEvent: (r) => rows.events.push(r),
  };
};
const msg = (over = {}) => ({
  source: 'discord', channel: 'eng-general', channelRule: { floor: 'internal', ingest: true },
  author: 'Ben', role: 'engineering', url: 'https://discord.test/1', created_at: '2026-11-11T12:00:00Z',
  text: 'Heads up: Smart Export slips to next Thursday. QA found a sync bug.', ...over,
});

test('模型只能把等級調高', () => {
  assert.equal(maxSensitivity('restricted', 'public'), 'restricted');
  assert.equal(maxSensitivity('internal', 'restricted'), 'restricted');
  assert.equal(maxSensitivity('internal', 'public'), 'internal');
});

test('逐字原話才收；不是原話的丟掉', async () => {
  const db = fakeDb();
  const ids = await ingestMessage(msg(), { db, extract: async () => [
    { summary: 'Launch slips', topics: ['launch'], sensitivity: 'public', quote: 'Smart Export slips to next Thursday' },
    { summary: 'Made up', topics: ['launch'], sensitivity: 'internal', quote: 'Smart Export is delayed by a week' },
  ] });
  assert.equal(ids.length, 1);
  assert.equal(db.rows.items[0].source_quote, 'Smart Export slips to next Thursday');
  assert.equal(db.rows.items[0].sensitivity, 'internal'); // 模型說 public，頻道下限是 internal
});

test('事故頻道一律至少 restricted，並發出 context_added 事件', async () => {
  const db = fakeDb();
  const text = 'No public statements about security or data safety until legal review on Friday.';
  await ingestMessage(msg({ channel: 'eng-incident', channelRule: { floor: 'restricted', ingest: true }, text }),
    { db, extract: async () => [{ summary: 'Legal hold', topics: ['security', 'comms'], sensitivity: 'internal', quote: text }] });
  assert.equal(db.rows.items[0].sensitivity, 'restricted');
  assert.equal(db.rows.events.length, 1);
  const payload = db.rows.events[0].payload;
  assert.deepEqual(payload.topics.sort(), ['comms', 'security']);
});

test('交稿頻道的訊息入庫但不進脈絡，也不呼叫模型', async () => {
  const db = fakeDb();
  let called = false;
  const ids = await ingestMessage(msg({ channel: 'pr-drafts', channelRule: { ingest: false, review: true } }),
    { db, extract: async () => { called = true; return []; } });
  assert.deepEqual(ids, []);
  assert.equal(db.rows.messages.length, 1);
  assert.equal(called, false);
  assert.equal(db.rows.events.length, 0);
});

test('閒聊沒有脈絡時不發事件', async () => {
  const db = fakeDb();
  await ingestMessage(msg({ text: 'lunch?' }), { db, extract: async () => [] });
  assert.equal(db.rows.events.length, 0);
});

const cfg = {
  channels: { channels: { 'eng-general': { floor: 'internal', ingest: true } }, aliases: { '一般': 'eng-general' }, webhookSpeakers: ['Dana'] },
  people: { people: { Dana: { role: 'legal', aliases: ['Dana'] }, Alice: { role: 'pr_lead', aliases: ['Alice'] }, Ben: { role: 'engineering', aliases: ['shuozhan'] } } },
};
const dm = (over = {}) => ({ author: { id: 'u1', username: 'ben', bot: false }, channel: { name: '一般' }, guild: { ownerId: 'owner' },
  content: 'hello', url: 'https://discord.test/2', createdTimestamp: 0, ...over });

test('頻道別名對得上；不在設定裡的頻道不處理', () => {
  assert.equal(resolveChannel('一般', cfg).name, 'eng-general');
  assert.equal(normalize(dm({ channel: { name: 'random' } }), cfg, 'self'), null);
});

test('機器人自己與沒登記的 webhook 不處理；登記過的 webhook 當成人', () => {
  assert.equal(normalize(dm({ author: { id: 'self', username: 'stick', bot: true } }), cfg, 'self'), null);
  assert.equal(normalize(dm({ webhookId: 'w', author: { id: 'w', username: 'GitHub', bot: true } }), cfg, 'self'), null);
  const dana = normalize(dm({ webhookId: 'w', author: { id: 'w', username: 'Dana', bot: true } }), cfg, 'self');
  assert.equal(dana.role, 'legal');
});

test('伺服器擁有者預設是公關主管', () => {
  const m = normalize(dm({ author: { id: 'owner', username: 'felix425.', bot: false } }), cfg, 'self');
  assert.equal(m.role, 'pr_lead');
  assert.equal(m.author, 'Alice'); // 用人員表裡的名字，審稿才找得到主管
});

test('Discord 帳號用 aliases 對到 demo 人物（不分大小寫）', () => {
  const m = normalize(dm({ author: { id: 'u9', username: 'ShuoZhan', bot: false } }), cfg, 'self');
  assert.equal(m.author, 'Ben');
  assert.equal(m.role, 'engineering');
});
