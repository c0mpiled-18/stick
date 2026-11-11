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

/** config/people.json（B 的檔案）裡，aliases 含這個名稱的人。比對不分大小寫。 */
function findByAlias(names, cfg) {
  const wanted = names.filter(Boolean).map((n) => String(n).toLowerCase());
  for (const [name, p] of Object.entries(cfg.people?.people ?? {})) {
    const aliases = [name, ...(p.aliases ?? [])].map((x) => String(x).toLowerCase());
    if (aliases.some((x) => wanted.includes(x))) return { user: name, role: p.role };
  }
  return null;
}

/** 這個人是誰：先比 aliases；伺服器擁有者預設是公關主管；其餘當工程。 */
export function resolvePerson({ authorId, authorName, displayName, isOwner }, cfg) {
  const hit = findByAlias([authorId, authorName, displayName], cfg);
  if (hit) return hit;
  if (isOwner) {
    const lead = Object.entries(cfg.people?.people ?? {}).find(([, p]) => p.role === 'pr_lead');
    return { user: lead?.[0] ?? authorName, role: 'pr_lead' };
  }
  return { user: authorName, role: 'engineering' };
}

/**
 * 回傳 null 代表這則訊息不處理（機器人自己、沒登記的 webhook、不在設定裡的頻道）。
 */
export function normalize(m, cfg, selfId) {
  if (m.author?.id === selfId) return null;
  const isWebhook = Boolean(m.webhookId);
  const authorName = m.author?.username ?? 'unknown';
  const knownWebhook = cfg.channels.webhookSpeakers?.includes(authorName) || findByAlias([authorName], cfg);
  if (isWebhook && !knownWebhook) return null;
  if (m.author?.bot && !isWebhook) return null;
  const channel = resolveChannel(m.channel?.name, cfg);
  if (!channel) return null;
  const text = (m.content ?? '').trim();
  if (!text) return null;
  const who = resolvePerson(
    { authorId: m.author?.id, authorName, displayName: m.member?.displayName ?? m.author?.globalName, isOwner: m.guild?.ownerId === m.author?.id },
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
