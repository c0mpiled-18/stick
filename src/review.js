// 審稿層：用稿件作者主管的權限拿脈絡，比對稿件，產出結論、問題、建議與引用。
// 交界：docs/STATUS.md「交界」。原屬 C；20:30 起由 antonshuo 先做（ryan 尚未開始）。
//
//   reviewDraft({ draftId, trigger, withStick }) → 審稿列（已存進 reviews）
//   onContextAdded(event)                         → 重審的稿件 id 陣列
//   startReReviewLoop({ intervalMs })             → 每隔一段時間掃 events，自動重審；回傳 stop()
//
// 原則：
// - 只透過 access.js 的 retrieveContext 拿脈絡（不直接查 context_items）
// - 不信模型自述：引用的 id 必須在脈絡包裡，引用的原話必須逐字出現在該條脈絡的原話裡，不符就丟
// - 問題的等級由程式依引用算，不由模型決定；給下屬看之前要過 access.redactReviewFor

import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import * as defaultDb from './db.js';
import * as defaultAccess from './access.js';

export const MODEL = 'claude-sonnet-5-5';

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'issues'],
  properties: {
    verdict: { type: 'string', enum: ['ok', 'needs_change', 'block'] },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'suggestion', 'cited_item_ids', 'quote'],
        properties: {
          text: { type: 'string', description: 'What in the draft conflicts with the context, in one sentence.' },
          suggestion: { type: 'string', description: 'A concrete rewrite or instruction for the writer.' },
          cited_item_ids: { type: 'array', items: { type: 'integer' }, description: 'IDs of the context items this issue relies on. Empty if none.' },
          quote: { type: 'string', description: 'Exact words copied from the source_quote of a cited item. Empty if no item is cited.' },
        },
      },
    },
  },
};

const SYSTEM = `You review press releases and public posts before they go out, on behalf of the writer's lead.
Compare the draft against the internal context you are given. Flag every statement in the draft that conflicts with, or would be unsafe given, that context: wrong dates, claims contradicted by incidents, statements that break a rule about what may be said publicly.
Rules:
- Only raise an issue if you can cite at least one context item for it. Copy "quote" exactly from that item's source_quote.
- Do not invent facts. If there is no internal context, judge only what the draft itself says.
- verdict: "block" if the draft must not go out as written (e.g. a false or forbidden public claim), "needs_change" for fixable inaccuracies, "ok" if nothing conflicts.
- Keep "text" and "suggestion" short and in English.`;

/** 預設的模型呼叫。測試時換成假的：({ system, user, schema }) → { verdict, issues } */
export async function callClaude({ system, user, schema }) {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content: user }],
  });
  if (response.stop_reason === 'refusal') throw new Error(`review refused: ${response.stop_details?.category ?? 'unknown'}`);
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

/** 組一個 deps 物件；測試傳 { store, access, callModel }。 */
export function createReviewer({ store = defaultDb, access = defaultAccess, callModel = callClaude } = {}) {
  async function reviewDraft({ draftId, trigger = 'submitted', withStick = true }) {
    const draft = store.getDraft(draftId);
    if (!draft) throw new Error(`draft ${draftId} does not exist`);
    const reviewer = access.getManager(draft.author) ?? draft.author;

    const { items, excludedCount } = withStick ? access.retrieveContext(reviewer) : { items: [], excludedCount: 0 };
    const packet = {
      viewer: reviewer,
      with_stick: withStick,
      items: items.map((i) => ({
        id: i.id, summary: i.summary, topics: i.topics, sensitivity: i.sensitivity,
        source_quote: i.source_quote, author: i.author, channel: i.channel, url: i.url,
      })),
      excludedCount,
    };
    const packetJson = JSON.stringify(packet);
    const packet_hash = createHash('sha256').update(packetJson).digest('hex').slice(0, 16);

    const contextBlock = packet.items.length
      ? packet.items.map((i) => JSON.stringify({ id: i.id, summary: i.summary, source_quote: i.source_quote, from: `${i.author} in #${i.channel}` })).join('\n')
      : '(no internal context)';
    const user = `Internal context (one JSON object per line):\n${contextBlock}\n\nDraft by ${draft.author} (revision ${draft.revision}):\n"""${draft.text}"""`;

    const raw = await callModel({ system: SYSTEM, user, schema: REVIEW_SCHEMA });

    // 不信模型自述：逐條檢查引用
    const byId = new Map(packet.items.map((i) => [i.id, i]));
    const issues = [];
    for (const issue of Array.isArray(raw?.issues) ? raw.issues : []) {
      const cited = [...new Set((issue.cited_item_ids ?? []).map(Number))];
      if (cited.length === 0) {
        // 沒有引用：只有在模型完全沒看到內部脈絡時才保留（不可能洩露），否則丟掉
        if (packet.items.length === 0) issues.push({ text: issue.text, suggestion: issue.suggestion, cited_item_ids: [], quote: '', sensitivity: 'public' });
        continue;
      }
      if (!cited.every((id) => byId.has(id))) continue; // 引用了脈絡包裡沒有的
      const quote = String(issue.quote ?? '').trim();
      if (!quote || !cited.some((id) => byId.get(id).source_quote.includes(quote))) continue; // 原話不是逐字
      issues.push({
        text: issue.text,
        suggestion: issue.suggestion,
        cited_item_ids: cited,
        quote,
        sensitivity: access.sensitivityOfItems(cited),
        sources: cited.map((id) => ({ id, url: byId.get(id).url, author: byId.get(id).author, channel: byId.get(id).channel })),
      });
    }

    let verdict = ['ok', 'needs_change', 'block'].includes(raw?.verdict) ? raw.verdict : 'needs_change';
    if (verdict !== 'ok' && issues.length === 0) verdict = 'ok'; // 說有問題卻舉不出有依據的問題 → 不採信
    if (verdict === 'ok' && issues.length > 0) verdict = 'needs_change';

    const id = store.insertReview({
      draft_id: draftId, reviewer, trigger, with_stick: withStick,
      context_packet: packet, packet_hash, verdict, issues,
    });
    return { ...store.latestReview(draftId), id };
  }

  /** 新脈絡進來：重審「最新版、最新結論是 ok 或 needs_change、主管看得到新脈絡」的稿件。 */
  async function onContextAdded(event) {
    const payload = event?.payload ?? {};
    const newIds = new Set((payload.context_item_ids ?? (payload.item_id != null ? [payload.item_id] : [])).map(Number));
    const topics = payload.topics ?? [];
    if (newIds.size === 0 && topics.length === 0) return [];

    const drafts = store.listDrafts();
    const hasChild = new Set(drafts.filter((d) => d.parent_id != null).map((d) => d.parent_id));
    const rereviewed = [];
    for (const d of drafts) {
      if (hasChild.has(d.id)) continue; // 只審最新版
      const last = store.latestReview(d.id);
      if (!last || !['ok', 'needs_change'].includes(last.verdict)) continue;
      if (!last.with_stick) continue;
      const reviewer = access.getManager(d.author) ?? d.author;
      const visible = access.retrieveContext(reviewer, topics.length ? { topics } : {}).items;
      const relevant = newIds.size ? visible.some((i) => newIds.has(i.id)) : visible.length > 0;
      if (!relevant) continue;
      await reviewDraft({ draftId: d.id, trigger: 'context_added', withStick: true });
      rereviewed.push(d.id);
    }
    return rereviewed;
  }

  /** 每 intervalMs 掃一次 events。從啟動當下最新的事件之後開始。 */
  function startReReviewLoop({ intervalMs = 5000, onReReviewed = () => {} } = {}) {
    let last = store.listEvents(0).at(-1)?.id ?? 0;
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        for (const e of store.listEvents(last)) {
          last = e.id;
          if (e.type !== 'context_added') continue;
          const ids = await onContextAdded(e);
          if (ids.length) onReReviewed(ids, e);
        }
      } catch (err) {
        console.error('re-review loop:', err.message);
      } finally {
        busy = false;
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }

  return { reviewDraft, onContextAdded, startReReviewLoop };
}

// ---- 預設 ----
let reviewer = null;
const r = () => (reviewer ??= createReviewer());

export const reviewDraft = (args) => r().reviewDraft(args);
export const onContextAdded = (event) => r().onContextAdded(event);
export const startReReviewLoop = (opts) => r().startReReviewLoop(opts);
