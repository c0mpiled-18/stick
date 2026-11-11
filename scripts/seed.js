// 把 demo 資料塞進資料庫，讓大家不用等機器人就能開發。
//
//   npm run seed                  # 新的 stick.db：C1–C3 對話與脈絡、Erin 的 v1 稿
//   node scripts/seed.js --reset  # 先刪掉資料庫檔案再塞（只刪檔案，表本身只增不改）
//   node scripts/seed.js --v2     # 加 Erin 的 v2 稿（parent 是最新的 v1）
//   node scripts/seed.js --c4     # 加 Ben 的「又延一週」：訊息、脈絡、context_added 事件（鏡 5）
//
// 資料庫位置：STICK_DB 或 ./stick.db

import { existsSync, rmSync } from 'node:fs';
import { openStore } from '../src/db.js';
import { MESSAGES, CONTEXT, DRAFTS } from './demo-data.js';

const args = new Set(process.argv.slice(2));
const path = process.env.STICK_DB || './stick.db';

if (args.has('--reset')) {
  for (const p of [path, `${path}-wal`, `${path}-shm`]) if (existsSync(p)) rmSync(p);
  console.log(`reset: removed ${path}`);
}

const store = openStore(path);

/** 一則訊息 → 訊息、脈絡、事件。回傳 { messageId, itemId } */
export function addConversation(s, key) {
  const m = MESSAGES[key];
  const messageId = s.insertMessage({ source: 'discord', ...m, url: `https://discord.com/channels/demo/${m.channel}/${key}` });
  const itemId = s.insertContextItem({ ...CONTEXT[key], source_message_id: messageId });
  s.insertEvent({ type: 'context_added', payload: { item_id: itemId, topics: CONTEXT[key].topics } });
  return { messageId, itemId };
}

const only = args.has('--v2') || args.has('--c4');

if (!only) {
  if (store.listMessages().length > 0) {
    console.error(`${path} already has data. Use --reset to start over.`);
    process.exit(1);
  }
  for (const key of ['C1', 'C2', 'C3']) {
    const { messageId, itemId } = addConversation(store, key);
    console.log(`${key}: message ${messageId}, context ${itemId} (${CONTEXT[key].sensitivity})`);
  }
  const v1 = store.insertDraft(DRAFTS.v1);
  console.log(`draft v1: ${v1}`);
}

if (args.has('--v2')) {
  const v1 = store.listDrafts().filter((d) => d.revision === 1).at(-1);
  if (!v1) throw new Error('no v1 draft; run seed without flags first');
  console.log(`draft v2: ${store.insertDraft({ ...DRAFTS.v2, parent_id: v1.id })}`);
}

if (args.has('--c4')) {
  const { messageId, itemId } = addConversation(store, 'C4');
  console.log(`C4: message ${messageId}, context ${itemId} (internal) + context_added event`);
}

store.close();
