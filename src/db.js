// 記憶層：SQLite 一個檔，五張表，只新增、不修改、不刪除。
// 交界：docs/STATUS.md「交界」。B（antonshuo）負責。
//
// 用法：
//   import { insertMessage, listDrafts } from './db.js';      // 用預設資料庫（STICK_DB 或 ./stick.db）
//   import { openStore } from './db.js'; const db = openStore(':memory:');  // 測試用
//
// 硬規則：除了 src/access.js，沒有任何檔案呼叫 listContextItems()。

import { DatabaseSync } from 'node:sqlite';

export const ENUMS = Object.freeze({
  source: ['discord', 'slack'],
  role: ['pr_staff', 'pr_lead', 'engineering', 'legal', 'bot'],
  sensitivity: ['public', 'internal', 'restricted'],
  trigger: ['submitted', 'context_added'],
  verdict: ['ok', 'needs_change', 'block'],
  eventType: ['context_added'],
});

const TABLES = ['messages', 'context_items', 'drafts', 'reviews', 'events'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  channel TEXT NOT NULL,
  author TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  url TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS context_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary TEXT NOT NULL,
  topics TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  source_message_id INTEGER NOT NULL REFERENCES messages(id),
  source_quote TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL,
  title TEXT,
  text TEXT NOT NULL,
  revision INTEGER NOT NULL,
  parent_id INTEGER REFERENCES drafts(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id INTEGER NOT NULL REFERENCES drafts(id),
  reviewer TEXT NOT NULL,
  trigger TEXT NOT NULL,
  with_stick INTEGER NOT NULL,
  context_packet TEXT NOT NULL,
  packet_hash TEXT,
  verdict TEXT NOT NULL,
  issues TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  at TEXT NOT NULL
);
${TABLES.map(
  (t) => `
CREATE TRIGGER IF NOT EXISTS ${t}_no_update BEFORE UPDATE ON ${t}
  BEGIN SELECT RAISE(ABORT, '${t} is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ${t}_no_delete BEFORE DELETE ON ${t}
  BEGIN SELECT RAISE(ABORT, '${t} is append-only'); END;`,
).join('\n')}
`;

/** 開一個資料庫並回傳全部函式。path 用 ':memory:' 給測試。 */
export function openStore(path = process.env.STICK_DB || './stick.db') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const now = () => new Date().toISOString();
  const insert = (sql, params) => Number(db.prepare(sql).run(...params).lastInsertRowid);
  const all = (sql, ...params) => db.prepare(sql).all(...params);
  const one = (sql, ...params) => db.prepare(sql).get(...params) ?? null;

  // ---- 寫入（回傳新的 id） ----

  function insertMessage({ source = 'discord', channel, author, role, text, url = null, created_at = now() }) {
    oneOf('source', source);
    oneOf('role', role);
    required({ channel, author, text });
    return insert(
      'INSERT INTO messages (source, channel, author, role, text, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [source, channel, author, role, text, url, created_at],
    );
  }

  function insertContextItem({ summary, topics = [], sensitivity, source_message_id, source_quote, created_at = now() }) {
    oneOf('sensitivity', sensitivity);
    required({ summary, source_message_id, source_quote });
    if (!Array.isArray(topics)) throw new TypeError('topics must be an array');
    const msg = one('SELECT text FROM messages WHERE id = ?', source_message_id);
    if (!msg) throw new Error(`message ${source_message_id} does not exist`);
    if (!msg.text.includes(source_quote)) throw new Error('source_quote must be a verbatim excerpt of the source message');
    return insert(
      'INSERT INTO context_items (summary, topics, sensitivity, source_message_id, source_quote, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [summary, JSON.stringify(topics), sensitivity, source_message_id, source_quote, created_at],
    );
  }

  /** parent_id 有給就是新版本，revision 自動 +1。 */
  function insertDraft({ author, title = null, text, parent_id = null, created_at = now() }) {
    required({ author, text });
    let revision = 1;
    if (parent_id != null) {
      const parent = one('SELECT revision FROM drafts WHERE id = ?', parent_id);
      if (!parent) throw new Error(`draft ${parent_id} does not exist`);
      revision = parent.revision + 1;
    }
    return insert(
      'INSERT INTO drafts (author, title, text, revision, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [author, title, text, revision, parent_id, created_at],
    );
  }

  function insertReview({ draft_id, reviewer, trigger, with_stick, context_packet, packet_hash = null, verdict, issues = [], at = now() }) {
    oneOf('trigger', trigger);
    oneOf('verdict', verdict);
    required({ draft_id, reviewer });
    if (!Array.isArray(issues)) throw new TypeError('issues must be an array');
    return insert(
      'INSERT INTO reviews (draft_id, reviewer, trigger, with_stick, context_packet, packet_hash, verdict, issues, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [draft_id, reviewer, trigger, with_stick ? 1 : 0, JSON.stringify(context_packet ?? {}), packet_hash, verdict, JSON.stringify(issues), at],
    );
  }

  function insertEvent({ type, payload = {}, at = now() }) {
    oneOf('eventType', type);
    return insert('INSERT INTO events (type, payload, at) VALUES (?, ?, ?)', [type, JSON.stringify(payload), at]);
  }

  // ---- 讀取 ----

  const listMessages = () => all('SELECT * FROM messages ORDER BY id');
  const getMessage = (id) => one('SELECT * FROM messages WHERE id = ?', id);
  const listDrafts = () => all('SELECT * FROM drafts ORDER BY id');
  const getDraft = (id) => one('SELECT * FROM drafts WHERE id = ?', id);
  const latestReview = (draftId) => parseReview(one('SELECT * FROM reviews WHERE draft_id = ? ORDER BY id DESC LIMIT 1', draftId));
  const listReviews = (draftId) =>
    (draftId == null ? all('SELECT * FROM reviews ORDER BY id') : all('SELECT * FROM reviews WHERE draft_id = ? ORDER BY id', draftId)).map(parseReview);
  const listEvents = (sinceId = 0) => all('SELECT * FROM events WHERE id > ? ORDER BY id', sinceId).map((e) => ({ ...e, payload: JSON.parse(e.payload) }));

  /** 只有 src/access.js 可以呼叫。其他地方一律走 retrieveContext。 */
  const listContextItems = () => all('SELECT * FROM context_items ORDER BY id').map((c) => ({ ...c, topics: JSON.parse(c.topics) }));

  return {
    db,
    insertMessage, insertContextItem, insertDraft, insertReview, insertEvent,
    listMessages, getMessage, listDrafts, getDraft, latestReview, listReviews, listEvents,
    listContextItems,
    close: () => db.close(),
  };
}

function parseReview(r) {
  if (!r) return null;
  return { ...r, with_stick: r.with_stick === 1, context_packet: JSON.parse(r.context_packet), issues: JSON.parse(r.issues) };
}

function oneOf(field, value) {
  if (!ENUMS[field].includes(value)) throw new TypeError(`${field} must be one of ${ENUMS[field].join(', ')}; got ${value}`);
}

function required(fields) {
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === '') throw new TypeError(`${k} is required`);
  }
}

// ---- 預設資料庫：第一次用到才開 ----

let store = null;
const s = () => (store ??= openStore());

export const insertMessage = (row) => s().insertMessage(row);
export const insertContextItem = (row) => s().insertContextItem(row);
export const insertDraft = (row) => s().insertDraft(row);
export const insertReview = (row) => s().insertReview(row);
export const insertEvent = (row) => s().insertEvent(row);
export const listMessages = () => s().listMessages();
export const getMessage = (id) => s().getMessage(id);
export const listDrafts = () => s().listDrafts();
export const getDraft = (id) => s().getDraft(id);
export const latestReview = (draftId) => s().latestReview(draftId);
export const listReviews = (draftId) => s().listReviews(draftId);
export const listEvents = (sinceId) => s().listEvents(sinceId);
/** 只有 src/access.js 可以呼叫。 */
export const listContextItems = () => s().listContextItems();
