// 脈絡層（A）：一則訊息 → 帶敏感等級的脈絡。
// 規矩：模型只能把等級調高；原話必須是訊息的逐字片段，不是就丟；寫完發 context_added 事件。
const LEVELS = ['public', 'internal', 'restricted'];
const rank = (s) => Math.max(0, LEVELS.indexOf(s));
export const maxSensitivity = (floor, model) => LEVELS[Math.max(rank(floor), rank(model))];

const TOOL = {
  name: 'record_context',
  description: 'Record the facts in this message that other teams would need to know. Return an empty list for small talk.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'One sentence, plain English.' },
            topics: { type: 'array', items: { type: 'string', enum: ['launch', 'security', 'comms', 'pricing', 'other'] } },
            sensitivity: { type: 'string', enum: LEVELS },
            quote: { type: 'string', description: 'A verbatim substring of the message that supports the summary.' },
          },
          required: ['summary', 'topics', 'sensitivity', 'quote'],
        },
      },
    },
    required: ['items'],
  },
};

/** 預設的模型呼叫。測試時換成假的。 */
export async function extractWithClaude({ text, channel }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 600,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{
        role: 'user',
        content: `Channel: #${channel}\nMessage:\n"""${text}"""\n\nExtract the facts a PR or support colleague would need before speaking publicly (dates, delays, incidents, restrictions on what may be said). Each quote must be copied exactly from the message. Sensitivity: "restricted" for security incidents, personal data, or legal holds; "internal" for unannounced plans and dates; "public" only if already announced.`,
      }],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const block = body.content?.find((b) => b.type === 'tool_use');
  return block?.input?.items ?? [];
}

/**
 * @param msg  src/sources/discord.js 的 normalize() 結果
 * @param deps { db, extract }；db 預設是 src/db.js（B 寫的）
 * @returns 新增的脈絡 id 陣列
 */
export async function ingestMessage(msg, deps = {}) {
  const db = deps.db ?? (await import('./db.js'));
  const extract = deps.extract ?? extractWithClaude;
  if (!msg || msg.role === 'bot') return [];

  const messageId = await db.insertMessage({
    source: msg.source, channel: msg.channel, author: msg.author, role: msg.role,
    text: msg.text, url: msg.url, created_at: msg.created_at,
  });
  if (!msg.channelRule?.ingest) return [];

  const floor = msg.channelRule.floor ?? 'internal';
  const candidates = await extract({ text: msg.text, channel: msg.channel });
  const ids = [];
  const topics = new Set();
  for (const c of candidates) {
    if (!c?.quote || !msg.text.includes(c.quote)) continue; // 不是逐字原話：丟掉
    const id = await db.insertContextItem({
      summary: c.summary,
      topics: c.topics ?? [],
      sensitivity: maxSensitivity(floor, c.sensitivity),
      source_message_id: messageId,
      source_quote: c.quote,
      created_at: new Date().toISOString(),
    });
    ids.push(id);
    (c.topics ?? []).forEach((t) => topics.add(t));
  }
  if (ids.length) {
    await db.insertEvent({
      type: 'context_added',
      payload: { context_item_ids: ids, topics: [...topics], message_id: messageId },
      at: new Date().toISOString(),
    });
  }
  return ids;
}
