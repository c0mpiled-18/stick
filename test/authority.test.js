import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../src/authority.js';

const D = 'dev-process';
const G = '一般';

// build-plan 第 5 節的七種情況
test('1. 主管在定案頻道講 → 定案', () => {
  assert.deepEqual(decide({ role: 'lead', channel: D, action: 'say' }), { status: 'decided' });
});
test('2. 工程在定案頻道講 → 已確認的事實', () => {
  assert.deepEqual(decide({ role: 'engineering', channel: D, action: 'say' }), { status: 'decided', kind: 'fact' });
});
test('3. 任何人在討論頻道講 → 未確認', () => {
  for (const role of ['support', 'engineering', 'cs', 'lead']) {
    assert.deepEqual(decide({ role, channel: G, action: 'say' }), { status: 'unconfirmed' }, role);
  }
});
test('4. 主管對未確認的項目按 ✅ → 定案', () => {
  assert.deepEqual(decide({ role: 'lead', action: 'approve', currentStatus: 'unconfirmed' }), { status: 'decided' });
});
test('5. 其他人按 ✅ → 沒反應', () => {
  for (const role of ['support', 'engineering', 'cs']) {
    assert.equal(decide({ role, action: 'approve', currentStatus: 'unconfirmed' }), null, role);
  }
});
test('6. 任何人 !flag → 待重查', () => {
  for (const role of ['support', 'engineering', 'cs', 'lead']) {
    assert.deepEqual(decide({ role, action: 'flag' }), { status: 'needs_recheck' }, role);
  }
});
test('7. 機器人的任何訊息 → 永遠不變成任何一種', () => {
  for (const action of ['say', 'approve', 'flag']) {
    assert.equal(decide({ role: 'bot', channel: D, action }), null, action);
  }
});

// 邊界
test('非主管、非工程在定案頻道講 → 仍是未確認', () => {
  assert.deepEqual(decide({ role: 'cs', channel: D, action: 'say' }), { status: 'unconfirmed' });
});
test('主管對已定案的項目按 ✅ → 沒反應', () => {
  assert.equal(decide({ role: 'lead', action: 'approve', currentStatus: 'decided' }), null);
});
test('不認得的頻道、角色、動作 → null', () => {
  assert.equal(decide({ role: 'lead', channel: 'random', action: 'say' }), null);
  assert.equal(decide({ role: 'ceo', channel: D, action: 'say' }), null);
  assert.equal(decide({ role: 'lead', channel: D, action: 'delete' }), null);
  assert.equal(decide(), null);
});
test('頻道名稱可由設定檔覆寫', () => {
  const ch = { discussion: 'talk', decision: 'decisions' };
  assert.deepEqual(decide({ role: 'lead', channel: 'decisions', action: 'say' }, ch), { status: 'decided' });
  assert.equal(decide({ role: 'lead', channel: D, action: 'say' }, ch), null);
});
