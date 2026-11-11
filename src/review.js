// 審稿層（C，ryan）：這份稿子跟團隊現況有沒有衝突、要改什麼。
// 交界：docs/STATUS.md「交界」。
//
//   reviewDraft({ draftId, trigger, withStick }) → 審稿列（已存進 reviews）
//   onContextAdded(event)                        → 被重審的稿件 id 陣列
//   staleDraftIds()                              → 有新脈絡還沒重審的稿件 id（網頁標記用）
//
// 規矩：
// 1. 脈絡只從 access.js 的 retrieveContext 拿，用「稿件作者的主管」的權限。
// 2. 不相信模型的自述：每條問題的引用要跟脈絡原話逐字相符，對不上就丟；
//    有 Stick 時，沒有任何有效引用的問題整條丟掉。
// 3. 結論由程式決定，不由模型決定：
//      沒有問題 → ok
//      有問題引用到限閱（restricted）脈絡 → block（寫稿的人自己修不了，主管要當面談）
//      其他 → needs_change
// 4. 問題的等級＝它提到的所有脈絡中最高的等級（模型聲稱引用但對不上的也算，寧可標高）。

import { createHash } from 'node:crypto';
import * as defaultDb from './db.js';
import * as defaultAccess from './access.js';

const LEVELS = ['public', 'internal', 'restricted'];
const TOPICS = ['launch', 'security', 'comms', 'pricing', 'other'];
const MIN_QUOTE = 8; // 太短的引用（例如一個字）不算數
const MODEL = 'claude-sonnet-5-5';

const TOOL = {
  name: 'report_review',
  description: 'Report the result of reviewing the draft.',
  input_schema: {
    type: 'object',
    properties: {
      draft_topics: {
        type: 'array',
        items: { type: 'string', enum: TOPICS },
        description: 'What the draft is about.',
      },
      issues: {
        type: 'array',
        description: 'One entry per problem. Empty if the draft can go out as is.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'What is wrong, in one sentence.' },
            suggestion: { type: 'string', description: 'How to fix it, in one sentence.' },
            quotes: {
              type: 'array',
              description: 'The context this issue relies on. Empty if no context was given.',
              items: {
                type: 'object',
                properties: {
                  item_id: { type: 'integer', description: 'The id of the context item.' },
                  quote: { type: 'string', description: 'Copied exactly from that item\'s quote.' },
                },
                required: ['item_id', 'quote'],
              },
            },
          },
          required: ['text', 'suggestion', 'quotes'],
        },
      },
    },
    required: ['draft_topics', 'issues'],
  },
};

function buildPrompt({ draft, packet }) {
  const context = packet.items.length
    ? packet.items
        .map((i) => `[${i.id}] ${i.author ?? 'unknown'} in #${i.channel ?? 'unknown'} (${i.sensitivity}): ${i.summary}\n    quote: "${i.source_quote}"`)
        .join('\n')
    : '(none available)';
  return [
    `You review a draft before it is published, on behalf of ${packet.reviewer}, who signs it off.`,
    '',
    'Team context (what the team has said recently):',
    context,
    '',
    `Draft by ${draft.author}${draft.title ? `, "${draft.title}"` : ''}:`,
    `"""${draft.text}"""`,
    '',
    'Report every statement in the draft that conflicts with the team context or breaks a restriction stated in it.',
    'One issue per conflict. For each issue, list every context item it relies on, and for each one copy an exact substring of its quote.',
    'Do not use information from a context item in an issue unless you list that item in the issue.',
    'Do not report style or wording preferences. If nothing conflicts, return no issues.',
    '',
    `Answer only by calling the ${TOOL.name} tool, exactly once.`,
  ].join('\n');
}

/** 預設的模型呼叫。測試時換成假的。回傳 { draft_topics, issues } */
export async function reviewWithClaude({ draft, packet }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      tools: [TOOL],
      // 這個模型不收強制指定工具（tool_choice: tool／any），所以用 auto 加上提示要求一定要呼叫
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: buildPrompt({ draft, packet }) }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const block = body.content?.find((b) => b.type === 'tool_use');
  // 沒呼叫工具就當成失敗，不當成「沒問題」：寧可審稿失敗，也不要放行沒審過的稿子
  if (!block?.input) throw new Error(`Claude did not call ${TOOL.name} (stop_reason: ${body.stop_reason})`);
  return block.input;
}

// 只把彎引號換成直引號（長度不變），其餘一字不差
const straighten = (s) => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

/** 引用是不是脈絡原話的逐字片段。是 → 回傳原話裡的那一段；不是 → null */
export function verbatim(quote, sourceQuote) {
  const q = straighten(quote ?? '').trim().replace(/^"+|"+$/g, '');
  if (q.length < MIN_QUOTE) return null;
  const at = straighten(sourceQuote).indexOf(q);
  return at < 0 ? null : sourceQuote.slice(at, at + q.length);
}

const maxLevel = (levels) => LEVELS[Math.max(0, ...levels.map((l) => LEVELS.indexOf(l)))];

/**
 * 建一組審稿函式。測試時傳入 openStore(':memory:')、createAccess({store}) 與假的 model。
 * @param {{store?: object, access?: object, model?: Function}} [opts]
 */
export function createReviewer({ store = defaultDb, access = defaultAccess, model = reviewWithClaude } = {}) {
  const inFlight = new Set(); // 正在重審的稿件，避免同一個程序重複審

  /** 組脈絡包：主管看得到的全部脈絡。沒有 Stick 就是空的。 */
  function buildPacket(reviewer, withStick) {
    if (!withStick) return { with_stick: false, reviewer, items: [], excluded_count: 0 };
    const { items, excludedCount } = access.retrieveContext(reviewer);
    return { with_stick: true, reviewer, clearance: access.clearanceOf(reviewer), items, excluded_count: excludedCount };
  }

  /** 模型回的問題 → 查核過的問題。對不上的引用丟掉；有 Stick 而沒有有效引用的問題整條丟掉。 */
  function checkIssues(rawIssues, packet) {
    const byId = new Map(packet.items.map((i) => [Number(i.id), i]));
    const out = [];
    for (const raw of Array.isArray(rawIssues) ? rawIssues : []) {
      const text = String(raw?.text ?? '').trim();
      const suggestion = String(raw?.suggestion ?? '').trim();
      if (!text) continue;

      if (!packet.with_stick) {
        // 沒有脈絡：問題只來自稿件本身，作者本來就看得到
        out.push({ text, suggestion, cited_item_ids: [], sensitivity: 'public', quotes: [] });
        continue;
      }

      const quotes = [];
      const claimed = new Set(); // 模型聲稱用到的脈絡，對不上的也記著，拿來標等級
      for (const q of Array.isArray(raw.quotes) ? raw.quotes : []) {
        const id = Number(q?.item_id);
        if (!Number.isInteger(id)) continue;
        claimed.add(id);
        const item = byId.get(id);
        const exact = item ? verbatim(q.quote, item.source_quote) : null;
        if (!exact) continue; // 不是逐字原話：這條引用丟掉
        if (quotes.some((x) => x.item_id === id && x.quote === exact)) continue;
        quotes.push({ item_id: id, quote: exact, author: item.author, channel: item.channel, url: item.url, source_message_id: item.source_message_id });
      }
      if (quotes.length === 0) continue; // 沒有任何查得到出處的依據：整條丟掉

      // 文字裡直接出現某條脈絡的原話，就算沒列引用也算用到了
      const body = straighten(`${text} ${suggestion}`);
      for (const item of packet.items) if (body.includes(straighten(item.source_quote))) claimed.add(Number(item.id));

      const levels = [...claimed].map((id) => byId.get(id)?.sensitivity ?? 'restricted');
      out.push({
        text,
        suggestion,
        cited_item_ids: [...new Set(quotes.map((q) => q.item_id))],
        sensitivity: maxLevel(levels),
        quotes,
      });
    }
    return out;
  }

  const decide = (issues) =>
    issues.length === 0 ? 'ok' : issues.some((i) => i.sensitivity === 'restricted') ? 'block' : 'needs_change';

  /**
   * 審一份稿子，存進 reviews，回傳審稿列。
   * @param {{draftId: number, trigger?: 'submitted'|'context_added', withStick?: boolean}} opts
   */
  async function reviewDraft({ draftId, trigger = 'submitted', withStick = true }) {
    const draft = await store.getDraft(draftId);
    if (!draft) throw new Error(`draft ${draftId} does not exist`);

    // 用作者主管的權限審；沒有主管就用作者自己的
    const reviewer = access.getManager(draft.author) ?? access.resolvePerson?.(draft.author) ?? draft.author;
    const packet = buildPacket(reviewer, withStick);
    // 指紋只算「帶進去的東西」，審稿後補上的 draft_topics 不算
    const packet_hash = createHash('sha256').update(JSON.stringify(packet)).digest('hex');

    const result = await model({ draft, packet });
    const issues = checkIssues(result?.issues, packet);
    const verdict = decide(issues);
    const draft_topics = (Array.isArray(result?.draft_topics) ? result.draft_topics : []).filter((t) => TOPICS.includes(t));

    const id = await store.insertReview({
      draft_id: draft.id,
      reviewer,
      trigger,
      with_stick: withStick,
      context_packet: { ...packet, draft_topics },
      packet_hash,
      verdict,
      issues,
    });
    return (await store.listReviews(draft.id)).find((r) => r.id === id);
  }

  /**
   * 每份稿件的最新版裡，哪些「上次審完之後又有主管看得到的新脈絡」。
   * 沒用 Stick 審過、或已經擋下的不算。
   * @returns {Promise<{draft: object, last: object, fresh: object[]}[]>} fresh＝上次沒帶到的脈絡
   */
  async function staleDrafts() {
    const drafts = await store.listDrafts();
    const hasChild = new Set(drafts.map((d) => d.parent_id).filter((x) => x != null));
    const out = [];
    for (const draft of drafts) {
      if (hasChild.has(draft.id)) continue; // 只看每份稿件的最新版
      const last = (await store.listReviews(draft.id)).filter((r) => r.with_stick).at(-1);
      if (!last || last.verdict === 'block') continue;
      const seen = new Set((last.context_packet?.items ?? []).map((i) => Number(i.id)));
      const fresh = access.retrieveContext(last.reviewer).items.filter((i) => !seen.has(Number(i.id)));
      if (fresh.length) out.push({ draft, last, fresh });
    }
    return out;
  }

  // 主題要有交集；任何一邊不知道主題就當成相關
  const related = (last, topics) => {
    const draftTopics = last.context_packet?.draft_topics ?? [];
    return topics.length === 0 || draftTopics.length === 0 || draftTopics.some((t) => topics.includes(t));
  };

  /** 需要重審的稿件 id（給網頁標「需重審」用，不含任何脈絡內容）。 */
  async function staleDraftIds() {
    return (await staleDrafts())
      .filter(({ last, fresh }) => related(last, fresh.flatMap((i) => i.topics ?? [])))
      .map(({ draft }) => draft.id);
  }

  /**
   * 新脈絡進來：找主題相關、最新結論是 ok 或 needs_change 的最新版稿件，重審。
   * event 可以是 events 表的一列（payload 裡有 context_item_ids、topics），
   * 也可以是機器人直接給的 { context_item_ids }。同一條脈絡審過就不再審。
   * @returns {Promise<number[]>} 被重審的稿件 id
   */
  async function onContextAdded(event) {
    const p = event?.payload ?? event ?? {};
    const newIds = (p.context_item_ids ?? (p.item_id != null ? [p.item_id] : [])).map(Number);
    if (newIds.length === 0) return [];

    const redone = [];
    for (const { draft, last, fresh } of await staleDrafts()) {
      const added = fresh.filter((i) => newIds.includes(Number(i.id)));
      if (added.length === 0) continue; // 主管看不到這條，或上次已經帶過
      const topics = p.topics?.length ? p.topics : added.flatMap((i) => i.topics ?? []);
      if (!related(last, topics)) continue;

      if (inFlight.has(draft.id)) continue;
      inFlight.add(draft.id);
      try {
        await reviewDraft({ draftId: draft.id, trigger: 'context_added', withStick: true });
        redone.push(draft.id);
      } finally {
        inFlight.delete(draft.id);
      }
    }
    return redone;
  }

  return { reviewDraft, onContextAdded, staleDraftIds, buildPacket, checkIssues };
}

// ---- 預設：用 src/db.js 的預設資料庫、src/access.js 與真的模型 ----
let reviewer = null;
const r = () => (reviewer ??= createReviewer());

export const reviewDraft = (opts) => r().reviewDraft(opts);
export const onContextAdded = (event) => r().onContextAdded(event);
/** 需要重審的稿件 id；src/server.js 用來標「需重審」與輪詢重審。 */
export const staleDraftIds = () => r().staleDraftIds();
