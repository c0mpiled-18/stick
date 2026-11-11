// demo 資料（docs/build-plan.md 第 6 節）。全部虛構。
// seed.js 寫進資料庫；leak-check.js 與測試拿來比對。

export const MESSAGES = {
  C1: { channel: 'eng-general', author: 'Ben', role: 'engineering', text: 'Heads up: Smart Export slips to next Thursday. QA found a sync bug.' },
  C2: { channel: 'eng-incident', author: 'Ben', role: 'engineering', text: "The export API exposed some users' email addresses for about two hours yesterday. Patched this morning." },
  C3: { channel: 'eng-incident', author: 'Dana', role: 'legal', text: 'No public statements about security or data safety until legal review on Friday.' },
  C4: { channel: 'eng-general', author: 'Ben', role: 'engineering', text: 'Bad news: Smart Export slips another week.' },
};

export const CONTEXT = {
  C1: { summary: 'Smart Export launch slips to next Thursday because of a sync bug.', topics: ['launch'], sensitivity: 'internal', source_quote: 'Smart Export slips to next Thursday' },
  C2: { summary: 'Export API exposed some users’ email addresses for about two hours; patched.', topics: ['security'], sensitivity: 'restricted', source_quote: "The export API exposed some users' email addresses for about two hours yesterday" },
  C3: { summary: 'Legal: no public statements about security or data safety until Friday review.', topics: ['security', 'comms'], sensitivity: 'restricted', source_quote: 'No public statements about security or data safety until legal review on Friday' },
  C4: { summary: 'Smart Export slips another week.', topics: ['launch'], sensitivity: 'internal', source_quote: 'Smart Export slips another week' },
};

export const DRAFTS = {
  v1: { author: 'Erin', title: 'Smart Export launch', text: 'Kestrel launches Smart Export tomorrow. Your data has always been safe with us — we have never had a security incident.' },
  v2: { author: 'Erin', title: 'Smart Export launch', text: 'Kestrel launches Smart Export next Thursday, making it easier to take your notes anywhere.' },
};

/** 限閱的原話：Erin 的任何畫面都不可以出現。 */
export const RESTRICTED_QUOTES = Object.entries(CONTEXT)
  .filter(([, c]) => c.sensitivity === 'restricted')
  .flatMap(([k, c]) => [c.source_quote, MESSAGES[k].text]);

/** 一則 demo 對話 → 訊息、脈絡、context_added 事件。回傳 { messageId, itemId } */
export function addConversation(store, key) {
  const m = MESSAGES[key];
  const messageId = store.insertMessage({ source: 'discord', ...m, url: `https://discord.com/channels/demo/${m.channel}/${key}` });
  const itemId = store.insertContextItem({ ...CONTEXT[key], source_message_id: messageId });
  store.insertEvent({ type: 'context_added', payload: { item_id: itemId, topics: CONTEXT[key].topics } });
  return { messageId, itemId };
}

/** 基本 demo：C1–C3 與 Erin 的 v1。回傳 { items: {C1,C2,C3}, v1 } */
export function seedBase(store) {
  const items = {};
  for (const key of ['C1', 'C2', 'C3']) items[key] = addConversation(store, key).itemId;
  return { items, v1: store.insertDraft(DRAFTS.v1) };
}
