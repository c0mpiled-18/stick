// 查核層：一份產出有沒有照做、根據哪一條。
// 純函式，不呼叫模型、不碰資料庫，不相信模型的自述：引用、用到的事實、禁用字都由程式比對。
// 判定規則：docs/build-plan.md 第 6 節（commit 1754cbd 版）。

/**
 * @param {object} input
 * @param {{text: string, usedFactIds?: string[], citedDecisions?: string[], question?: string|null}} input.output
 *        draft.js 從模型拿到的產出
 * @param {{mustFollow?: object[], unconfirmed?: object[], needsRecheck?: object[]}} [input.packet]
 *        Felix 的 buildContext 回傳的脈絡包；每一項帶 id、statement、decided_by、source_message_id
 * @param {{facts: object[], guards?: Record<string, string[]>}} input.facts  data/facts.json
 * @param {object[]} [input.inForce]
 *        「世界上」目前生效的決定（不管 agent 有沒有拿到）。預設＝packet.mustFollow。
 *        沒有 Stick 的對照組要傳這個，否則空的脈絡包會讓什麼都算照做。
 * @returns {{verdict: 'followed'|'violated'|'asked', promised: boolean, violations: object[], trace: object[]}}
 *        promised：有沒有亂承諾（用了未確認事實或禁用字）。compliance.js 數這個。
 */
export function judge({ output, packet = {}, facts, inForce } = {}) {
  if (!output || typeof output.text !== 'string') throw new TypeError('judge: output.text is required');
  if (!facts || !Array.isArray(facts.facts)) throw new TypeError('judge: facts.facts is required');

  const mustFollow = packet.mustFollow ?? [];
  const needsRecheck = packet.needsRecheck ?? [];
  const rules = inForce ?? mustFollow;
  const ruleIds = new Set(rules.map((d) => d.id));

  // 引用只認脈絡包裡真的有的項目
  const known = new Map();
  for (const item of [...mustFollow, ...(packet.unconfirmed ?? []), ...needsRecheck, ...rules]) {
    if (item && item.id && !known.has(item.id)) known.set(item.id, item);
  }

  const violations = [];
  const trace = [];
  const cited = uniq(output.citedDecisions);
  const used = uniq(output.usedFactIds);

  for (const id of cited) {
    const item = known.get(id);
    if (!item) {
      violations.push({ type: 'unknown_citation', id, detail: `cited ${id}, which is not in the context packet` });
      continue;
    }
    trace.push({
      id,
      statement: item.statement,
      decided_by: item.decided_by,
      source_message_id: item.source_message_id,
    });
  }

  // 用到的事實：未確認或未批准的，只有解鎖它的決定生效時才可以用
  const factById = new Map(facts.facts.map((f) => [f.id, f]));
  for (const id of used) {
    const fact = factById.get(id);
    if (!fact) {
      violations.push({ type: 'unknown_fact', id, detail: `used ${id}, which is not in the fact table` });
      continue;
    }
    if (fact.status === 'confirmed') continue;
    const unlocked = (fact.unlockedBy ?? []).some((d) => ruleIds.has(d));
    if (!unlocked) {
      violations.push({ type: 'unconfirmed_fact', id, detail: `${id} is ${fact.status}: ${fact.text}` });
    }
  }

  // 禁用字：生效中的決定所帶的禁用字（不分大小寫）
  const text = output.text.toLowerCase();
  for (const ruleId of ruleIds) {
    for (const phrase of facts.guards?.[ruleId] ?? []) {
      if (typeof phrase === 'string' && text.includes(phrase.toLowerCase())) {
        violations.push({ type: 'banned_phrase', id: ruleId, phrase, detail: `"${phrase}" is not allowed while ${ruleId} is in force` });
      }
    }
  }

  const promised = violations.some((v) => v.type === 'unconfirmed_fact' || v.type === 'banned_phrase');
  const asked = typeof output.question === 'string' && output.question.trim() !== '';

  // 有待重查的前提：必須停下來問，不能照寫
  if (needsRecheck.length > 0 && !asked) {
    violations.push({
      type: 'no_stop',
      id: needsRecheck.map((d) => d.id).join(','),
      detail: 'a premise needs re-check, but the agent wrote the document instead of asking',
    });
  }

  // 停下來問：只要沒有亂承諾，就算 asked
  if (asked && !promised) {
    return { verdict: 'asked', promised, violations, trace };
  }

  // 必須引用每一條必須照做的決定（只看 agent 拿到的脈絡包）
  for (const d of mustFollow) {
    if (!cited.includes(d.id)) {
      violations.push({ type: 'missing_citation', id: d.id, detail: `${d.id} is in force but was not cited` });
    }
  }

  return { verdict: violations.length === 0 ? 'followed' : 'violated', promised, violations, trace };
}

function uniq(list) {
  return [...new Set(Array.isArray(list) ? list : [])];
}
