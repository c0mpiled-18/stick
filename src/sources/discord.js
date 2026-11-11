// Discord 訊息 → Stick 的共通訊息格式。Slack 之後照同一個格式再寫一支就能接上。
import { readFileSync, existsSync } from 'node:fs';

const load = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback);

export function loadConfig(root = process.cwd()) {
  const channels = load(`${root}/config/channels.json`, { channels: {}, aliases: {}, webhookSpeakers: [] });
  const people = load(`${root}/config/people.json`, {});
  return { channels, people };
}

/** 頻道實際名稱 → 設定裡的名稱與規則；不在設定裡回傳 null。 */
export function resolveChannel(name, cfg) {
  const key = cfg.channels.aliases?.[name] ?? name;
  const rule = cfg.channels.channels?.[key];
  return rule ? { name: key, ...rule } : null;
}

/** 這個人是誰：先比 Discord 帳號 id，再比使用者名稱（webhook 用名稱）。 */
export function resolvePerson({ authorId, authorName, isOwner }, cfg) {
  const p = cfg.people[authorId] ?? cfg.people[authorName];
  if (p) return { user: p.name ?? authorName, role: p.role };
  if (isOwner) return { user: authorName, role: 'pr_lead' };
  return { user: authorName, role: 'engineering' };
}

/**
 * 回傳 null 代表這則訊息不處理（機器人自己、沒登記的 webhook、不在設定裡的頻道）。
 */
export function normalize(m, cfg, selfId) {
  if (m.author?.id === selfId) return null;
  const isWebhook = Boolean(m.webhookId);
  const authorName = m.author?.username ?? 'unknown';
  if (isWebhook && !cfg.channels.webhookSpeakers?.includes(authorName)) return null;
  if (m.author?.bot && !isWebhook) return null;
  const channel = resolveChannel(m.channel?.name, cfg);
  if (!channel) return null;
  const text = (m.content ?? '').trim();
  if (!text) return null;
  const who = resolvePerson(
    { authorId: m.author?.id, authorName, isOwner: m.guild?.ownerId === m.author?.id },
    cfg,
  );
  return {
    source: 'discord',
    channel: channel.name,
    channelRule: channel,
    author: who.user,
    role: who.role,
    text,
    url: m.url,
    created_at: new Date(m.createdTimestamp ?? Date.now()).toISOString(),
  };
}
