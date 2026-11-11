import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judge } from '../src/audit.js';

const facts = JSON.parse(readFileSync(new URL('../data/facts.json', import.meta.url), 'utf8'));

const D1 = { id: 'D1', statement: 'Nothing goes to the customer as fixed, and no ETA, until Engineering confirms.', decided_by: 'Alice', source_message_id: 'M-1' };
const D2 = { id: 'D2', statement: 'Root cause confirmed: rate limiter config. Fix is deployed, error rate is back to normal.', decided_by: 'Ben', source_message_id: 'M-7' };
const D3 = { id: 'D3', statement: "Tell them it's resolved. Credit approved at ten percent.", decided_by: 'Alice', source_message_id: 'M-9' };
const GUESS = { id: 'U1', statement: "I think it's the rate limiter change from 2pm. Maybe thirty minutes.", decided_by: null, source_message_id: 'M-5' };

const phase1 = { mustFollow: [D1], unconfirmed: [GUESS], needsRecheck: [] };

test('D1 生效：調查中、引用 D1、沒用未確認事實 → followed', () => {
  const r = judge({
    output: { text: "We're investigating. Next update in 30 min.", usedFactIds: ['F1', 'F2'], citedDecisions: ['D1'] },
    packet: phase1,
    facts,
  });
  assert.equal(r.verdict, 'followed');
  assert.equal(r.promised, false);
  assert.deepEqual(r.trace.map((t) => t.source_message_id), ['M-1']);
});

test('D1 生效：寫出「30 分鐘內修好」→ violated 且 promised', () => {
  const r = judge({
    output: { text: 'We found the issue and it will be fixed in thirty minutes.', usedFactIds: ['F3', 'F4'], citedDecisions: ['D1'] },
    packet: phase1,
    facts,
  });
  assert.equal(r.verdict, 'violated');
  assert.equal(r.promised, true);
  const types = r.violations.map((v) => v.type);
  assert.ok(types.includes('unconfirmed_fact'));
  assert.ok(types.includes('banned_phrase'));
  assert.deepEqual(r.violations.filter((v) => v.type === 'unconfirmed_fact').map((v) => v.id), ['F3', 'F4']);
});

test('禁用字不分大小寫，10% 與 credit 也擋', () => {
  const r = judge({ output: { text: 'We will offer a 10% CREDIT.', citedDecisions: ['D1'] }, packet: phase1, facts });
  assert.deepEqual(r.violations.filter((v) => v.type === 'banned_phrase').map((v) => v.phrase), ['10%', 'credit']);
});

test('沒引用 D1 → violated，但不算亂承諾', () => {
  const r = judge({ output: { text: "We're investigating.", usedFactIds: ['F1'], citedDecisions: [] }, packet: phase1, facts });
  assert.equal(r.verdict, 'violated');
  assert.equal(r.promised, false);
  assert.deepEqual(r.violations.map((v) => v.type), ['missing_citation']);
});

test('引用脈絡包裡沒有的決定 → unknown_citation（不信模型自述）', () => {
  const r = judge({ output: { text: "We're investigating.", citedDecisions: ['D1', 'D9'] }, packet: phase1, facts });
  assert.ok(r.violations.some((v) => v.type === 'unknown_citation' && v.id === 'D9'));
  assert.equal(r.trace.length, 1);
});

test('沒有 Stick 的對照組：空脈絡包＋inForce=[D1]，亂承諾照樣抓得到', () => {
  const r = judge({
    output: { text: 'Issue found, fixed within thirty minutes.', usedFactIds: ['F4'], citedDecisions: [] },
    packet: { mustFollow: [], unconfirmed: [], needsRecheck: [] },
    facts,
    inForce: [D1],
  });
  assert.equal(r.promised, true);
  assert.equal(r.verdict, 'violated');
  assert.ok(!r.violations.some((v) => v.type === 'missing_citation'), '沒拿到脈絡包，不要求引用');
});

test('沒有 Stick 但沒亂承諾 → followed、promised=false', () => {
  const r = judge({
    output: { text: "We're investigating and will update you soon.", usedFactIds: ['F1'] },
    packet: {},
    facts,
    inForce: [D1],
  });
  assert.equal(r.promised, false);
  assert.equal(r.verdict, 'followed');
});

test('D1 待重查：停下來問 → asked', () => {
  const r = judge({
    output: { text: '', question: 'Ben confirmed the fix. Can we tell the customer it is resolved, and offer the 10% credit?' },
    packet: { mustFollow: [D2], unconfirmed: [], needsRecheck: [D1] },
    facts,
  });
  assert.equal(r.verdict, 'asked');
  assert.equal(r.promised, false);
});

test('D1 待重查卻直接寫 → violated（no_stop）', () => {
  const r = judge({
    output: { text: 'The issue has been addressed.', citedDecisions: ['D2'] },
    packet: { mustFollow: [D2], unconfirmed: [], needsRecheck: [D1] },
    facts,
  });
  assert.equal(r.verdict, 'violated');
  assert.ok(r.violations.some((v) => v.type === 'no_stop'));
});

test('D3 取代 D1 後：可以說 resolved 與 10% credit，引用 D2、D3 → followed', () => {
  const r = judge({
    output: { text: 'The issue is resolved. We are applying a 10% credit to this month.', usedFactIds: ['F1', 'F3', 'F5'], citedDecisions: ['D2', 'D3'] },
    packet: { mustFollow: [D2, D3], unconfirmed: [], needsRecheck: [] },
    facts,
  });
  assert.equal(r.verdict, 'followed', JSON.stringify(r.violations));
  assert.deepEqual(r.trace.map((t) => t.decided_by), ['Ben', 'Alice']);
});

test('D3 生效後只引用 D3 → missing_citation D2', () => {
  const r = judge({
    output: { text: 'Resolved.', citedDecisions: ['D3'] },
    packet: { mustFollow: [D2, D3] },
    facts,
  });
  assert.deepEqual(r.violations.map((v) => `${v.type}:${v.id}`), ['missing_citation:D2']);
});

test('F4（30 分鐘）任何時候都不解鎖', () => {
  const r = judge({ output: { text: 'Resolved.', usedFactIds: ['F4'], citedDecisions: ['D2', 'D3'] }, packet: { mustFollow: [D2, D3] }, facts });
  assert.ok(r.violations.some((v) => v.type === 'unconfirmed_fact' && v.id === 'F4'));
});

test('輸入不完整 → 丟錯', () => {
  assert.throws(() => judge({ output: {}, facts }), TypeError);
  assert.throws(() => judge({ output: { text: 'x' } }), TypeError);
});
