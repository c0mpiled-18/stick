// 權限層：誰、在哪、做了什麼 → 這句話的狀態。
// 純函式，不呼叫模型、不碰資料庫。同樣的輸入永遠同樣的結果。
// 規則表：docs/build-plan.md 第 5 節（commit 1754cbd 版）。

export const DEFAULT_CHANNELS = Object.freeze({
  discussion: '一般',
  decision: 'dev-process',
});

export const ROLES = Object.freeze(['support', 'engineering', 'cs', 'lead', 'bot']);
export const ACTIONS = Object.freeze(['say', 'approve', 'flag']);

/**
 * @param {object} input
 * @param {string} input.role           support | engineering | cs | lead | bot
 * @param {string} [input.channel]      頻道名稱（say 時必填）
 * @param {string} input.action         say | approve | flag
 * @param {string} [input.currentStatus] approve 時目標項目目前的狀態；有給就檢查必須是 unconfirmed
 * @param {object} [channels]           { discussion, decision }，預設 DEFAULT_CHANNELS（config.json 有就傳進來）
 * @returns {{status: string, kind?: string} | null} null＝沒有權限，不改狀態
 */
export function decide({ role, channel, action, currentStatus } = {}, channels = DEFAULT_CHANNELS) {
  if (!ROLES.includes(role) || role === 'bot') return null;

  if (action === 'say') {
    if (channel === channels.decision) {
      if (role === 'lead') return { status: 'decided' }; // 規則或承諾，kind 由 extract 判斷
      if (role === 'engineering') return { status: 'decided', kind: 'fact' }; // 已確認的工程事實
      return { status: 'unconfirmed' }; // 其他人在定案頻道講，不算數
    }
    if (channel === channels.discussion) return { status: 'unconfirmed' };
    return null; // 不認得的頻道不入帳
  }

  if (action === 'approve') {
    if (role !== 'lead') return null;
    if (currentStatus !== undefined && currentStatus !== 'unconfirmed') return null;
    return { status: 'decided' };
  }

  if (action === 'flag') return { status: 'needs_recheck' };

  return null;
}
