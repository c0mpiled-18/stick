// Discord 機器人（A）：收訊息 → 整理成脈絡；收到 !review 就交給審稿（C）。
// 執行：node --env-file=.env src/bot.js
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { loadConfig, normalize } from './sources/discord.js';
import { ingestMessage } from './ingest.js';

const cfg = loadConfig();
const optional = async (path) => { try { return await import(path); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; return null; } };
const db = await optional('./db.js');       // B
const review = await optional('./review.js'); // C
const access = await optional('./access.js'); // B
if (!db) console.log('[stick] 找不到 src/db.js，先只印出訊息、不入庫');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, (c) => {
  const names = c.channels.cache.filter((ch) => ch.isTextBased?.() && ch.name).map((ch) => `#${ch.name}`);
  console.log(`[stick] 已連線：${c.user.tag}｜看得到的頻道：${names.join(' ')}`);
});

async function handleReview(msg, raw) {
  const text = msg.text.replace(/^!review\s*/i, '').trim();
  if (!text) return raw.reply('用法：`!review <稿件內容>`');
  if (!db || !review) return raw.reply('審稿模組還沒接上。');
  const prev = (await db.listDrafts()).filter((d) => d.author === msg.author).at(-1);
  const draftId = await db.insertDraft({
    author: msg.author, title: text.slice(0, 40), text,
    revision: (prev?.revision ?? 0) + 1, parent_id: prev?.id ?? null, created_at: msg.created_at,
  });
  const result = await review.reviewDraft({ draftId, trigger: 'submitted', withStick: true });
  const shown = access?.redactReviewFor ? await access.redactReviewFor(msg.author, result) : result;
  const issues = typeof shown.issues === 'string' ? JSON.parse(shown.issues) : shown.issues ?? [];
  const lines = issues.map((i, n) => `${n + 1}. ${i.text}${i.suggestion ? ` → ${i.suggestion}` : ''}`);
  return raw.reply(`**${shown.verdict}**（第 ${prev ? prev.revision + 1 : 1} 版）\n${lines.join('\n') || '沒有問題。'}`.slice(0, 1900));
}

client.on(Events.MessageCreate, async (raw) => {
  const msg = normalize(raw, cfg, client.user.id);
  if (!msg) return;
  console.log(`[msg] #${msg.channel} ${msg.author}(${msg.role}): ${msg.text.slice(0, 80)} ${msg.url}`);
  try {
    if (/^!review\b/i.test(msg.text) && msg.channelRule.review) return await handleReview(msg, raw);
    if (!db) return;
    const ids = await ingestMessage(msg, { db });
    if (ids.length) {
      console.log(`[ctx] 新增 ${ids.length} 條脈絡：${ids.join(', ')}`);
      const redo = (await review?.onContextAdded?.({ type: 'context_added', context_item_ids: ids })) ?? [];
      if (redo.length) console.log(`[review] 重審稿件：${redo.join(', ')}`);
    }
  } catch (e) {
    console.error('[stick] 處理訊息失敗：', e.message);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
