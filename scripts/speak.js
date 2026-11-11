// demo 發言腳本：用 Discord webhook 以 Ben／Dana／Erin 的名字在對的頻道發 demo 訊息。
//
//   node --env-file=.env scripts/speak.js C3            # Dana 在 eng-incident 說法務規定
//   node --env-file=.env scripts/speak.js C1 C2 C3      # 依序發（每則間隔 --gap 秒，預設 3）
//   node --env-file=.env scripts/speak.js base          # = C1 C2 C3（鏡 2）
//   node --env-file=.env scripts/speak.js C4            # Ben：又延一週（鏡 5）
//   node --env-file=.env scripts/speak.js v1            # Erin 在 pr-drafts 交 v1：「!review <稿件>」
//   node --env-file=.env scripts/speak.js base --dry    # 只印出要發什麼，不送出
//
// .env 需要（每個頻道一個 webhook；網址是祕密，只放 .env，不進 repo、不貼聊天）：
//   DISCORD_WEBHOOK_ENG_GENERAL=https://discord.com/api/webhooks/...
//   DISCORD_WEBHOOK_ENG_INCIDENT=https://discord.com/api/webhooks/...
//   DISCORD_WEBHOOK_PR_DRAFTS=https://discord.com/api/webhooks/...   （選填，只有 v1／v2 需要）
//
// 注意：webhook 發的訊息在 Discord 裡 author.bot 是 true、message.webhookId 有值。
// 機器人要把「有 webhookId 且名字在 config/people.json 別名裡」的訊息當成人的訊息，不能一律略過。

import { MESSAGES, DRAFTS } from './demo-data.js';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const gi = args.indexOf('--gap');
const gapSec = gi >= 0 ? Number(args[gi + 1]) : 3;
const keys = args
  .filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--gap')
  .flatMap((a) => (a === 'base' ? ['C1', 'C2', 'C3'] : [a]));

if (keys.length === 0) {
  console.error('usage: node --env-file=.env scripts/speak.js <C1|C2|C3|C4|v1|v2|base> ... [--dry] [--gap 3]');
  process.exit(2);
}

/** 頻道名稱 → 環境變數名稱：eng-incident → DISCORD_WEBHOOK_ENG_INCIDENT */
export const envNameFor = (channel) => `DISCORD_WEBHOOK_${channel.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

function planFor(key) {
  if (MESSAGES[key]) {
    const m = MESSAGES[key];
    return { key, channel: m.channel, username: m.author, content: m.text };
  }
  if (DRAFTS[key]) {
    const d = DRAFTS[key];
    return { key, channel: 'pr-drafts', username: d.author, content: `!review ${d.text}` };
  }
  throw new Error(`unknown key ${key}; use C1–C4, v1, v2 or base`);
}

const plans = keys.map(planFor);

// 先檢查所有需要的 webhook 都設好，避免發到一半才失敗
const missing = [...new Set(plans.map((p) => envNameFor(p.channel)))].filter((n) => !process.env[n]);
if (missing.length && !dry) {
  console.error(`missing in .env: ${missing.join(', ')}`);
  process.exit(2);
}

for (const [i, p] of plans.entries()) {
  if (i > 0 && !dry) await new Promise((r) => setTimeout(r, gapSec * 1000));
  const label = `${p.key}  #${p.channel}  ${p.username}: ${p.content}`;
  if (dry) {
    console.log(`[dry] ${label}`);
    continue;
  }
  const url = new URL(process.env[envNameFor(p.channel)]);
  url.searchParams.set('wait', 'true'); // 回傳建立的訊息，才拿得到連結
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: p.content, username: p.username, allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) {
    console.error(`FAIL ${label}\n  HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    process.exitCode = 1;
    break;
  }
  const msg = await res.json();
  console.log(`sent ${label}\n  message ${msg.id} in channel ${msg.channel_id}`);
}
