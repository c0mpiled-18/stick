// 權限層：誰看得到哪條脈絡。唯一可以讀 context_items 的地方。
// 純規則，不呼叫模型。交界：docs/STATUS.md「交界」。B（antonshuo）負責。
//
// 原則：不確定就當成看不到（fail closed）。不認得的人只看得到 public；
// 不知道等級的審稿問題當成 restricted。

import { readFileSync } from 'node:fs';
import * as defaultDb from './db.js';

export const LEVELS = Object.freeze(['public', 'internal', 'restricted']);
export const REDACTED_TEXT = 'Your lead has one more change to discuss with you directly.';

const DEFAULT_PEOPLE = JSON.parse(readFileSync(new URL('../config/people.json', import.meta.url), 'utf8'));

/**
 * 建一組權限函式。測試時傳入 openStore(':memory:') 與自訂的 people。
 * @param {{store?: object, people?: object}} [opts]
 */
export function createAccess({ store = defaultDb, people = DEFAULT_PEOPLE } = {}) {
  const byAlias = new Map();
  for (const [name, p] of Object.entries(people.people)) {
    byAlias.set(name.toLowerCase(), name);
    for (const a of p.aliases ?? []) byAlias.set(String(a).toLowerCase(), name);
  }

  /** Discord 帳號名稱、webhook 名稱或人名 → 人名；不認得回傳 null。 */
  function resolvePerson(user) {
    if (user == null) return null;
    return byAlias.get(String(user).toLowerCase()) ?? null;
  }

  function roleOf(user) {
    const name = resolvePerson(user);
    return name ? people.people[name].role : null;
  }

  /** 看得到的等級陣列。不認得的人只有 public。 */
  function clearanceOf(user) {
    const role = roleOf(user);
    if (!role) return ['public'];
    return [...(people.clearance[role] ?? [])];
  }

  function canSee(user, sensitivity) {
    return clearanceOf(user).includes(sensitivity);
  }

  /** 稿件作者的主管（人名）；沒有主管回傳 null。 */
  function getManager(user) {
    const name = resolvePerson(user);
    return name ? people.people[name].manager ?? null : null;
  }

  /**
   * 唯一的讀取口。只回傳 viewer 看得到的脈絡。
   * @param {string} viewer
   * @param {{topics?: string[]}} [opts] 有給 topics 就只回傳主題有交集的
   * @returns {{items: object[], excludedCount: number}} excludedCount＝符合主題但因權限沒帶入的條數（不列內容）
   */
  function retrieveContext(viewer, { topics } = {}) {
    const wanted = Array.isArray(topics) && topics.length > 0 ? new Set(topics) : null;
    const messages = new Map(store.listMessages().map((m) => [m.id, m]));
    const items = [];
    let excludedCount = 0;
    for (const c of store.listContextItems()) {
      if (wanted && !c.topics.some((t) => wanted.has(t))) continue;
      if (!canSee(viewer, c.sensitivity)) {
        excludedCount++;
        continue;
      }
      const m = messages.get(c.source_message_id);
      items.push({
        id: c.id,
        summary: c.summary,
        topics: c.topics,
        sensitivity: c.sensitivity,
        source_quote: c.source_quote,
        source_message_id: c.source_message_id,
        author: m?.author ?? null,
        channel: m?.channel ?? null,
        url: m?.url ?? null,
        created_at: c.created_at,
      });
    }
    return { items, excludedCount };
  }

  /** 一組脈絡 id 中最高的等級。找不到的 id 當成 restricted。給 review.js 標問題等級用。 */
  function sensitivityOfItems(ids = []) {
    const known = new Map(store.listContextItems().map((c) => [c.id, c.sensitivity]));
    let max = 0;
    for (const id of ids) {
      const level = known.get(Number(id)) ?? 'restricted';
      max = Math.max(max, LEVELS.indexOf(level));
    }
    return LEVELS[max];
  }

  /**
   * 審稿結果給 viewer 看之前先過這裡。
   * - 問題的等級 viewer 看不到 → 換成固定文字，不給建議、引用與原話
   * - 問題沒標等級 → 由引用的脈絡算；沒有引用也沒有等級 → 當成 restricted
   * - 脈絡包：viewer 看不到其中任何一條 → 整包換成 { redacted: true }
   */
  function redactReviewFor(viewer, review) {
    if (!review) return review;
    const issues = (review.issues ?? []).map((issue) => {
      // 取「標的等級」與「引用算出的等級」較高者：審稿程式標低了也不會放行
      const labeled = LEVELS.includes(issue.sensitivity) ? issue.sensitivity : null;
      const derived = issue.cited_item_ids?.length ? sensitivityOfItems(issue.cited_item_ids) : null;
      const level = labeled || derived
        ? LEVELS[Math.max(LEVELS.indexOf(labeled ?? 'public'), LEVELS.indexOf(derived ?? 'public'))]
        : 'restricted';
      if (canSee(viewer, level)) return { ...issue, sensitivity: level };
      return { text: REDACTED_TEXT, redacted: true };
    });
    const packetIds = collectIds(review.context_packet);
    const packetVisible = packetIds.every((id) => canSee(viewer, sensitivityOfItems([id])));
    return {
      ...review,
      issues,
      context_packet: packetVisible ? review.context_packet : { redacted: true },
    };
  }

  return { resolvePerson, roleOf, clearanceOf, canSee, getManager, retrieveContext, sensitivityOfItems, redactReviewFor };
}

// 脈絡包裡出現的脈絡 id：packet.items[].id，或任何帶 id 與 sensitivity 的物件
function collectIds(packet) {
  if (!packet || typeof packet !== 'object') return [];
  const ids = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      if (v.id != null && v.sensitivity) ids.push(v.id);
      Object.values(v).forEach(walk);
    }
  };
  walk(packet);
  return ids;
}

// ---- 預設：用 src/db.js 的預設資料庫與 config/people.json ----
let access = null;
const a = () => (access ??= createAccess());

export const resolvePerson = (user) => a().resolvePerson(user);
export const roleOf = (user) => a().roleOf(user);
export const clearanceOf = (user) => a().clearanceOf(user);
export const canSee = (user, level) => a().canSee(user, level);
export const getManager = (user) => a().getManager(user);
export const retrieveContext = (viewer, opts) => a().retrieveContext(viewer, opts);
export const sensitivityOfItems = (ids) => a().sensitivityOfItems(ids);
export const redactReviewFor = (viewer, review) => a().redactReviewFor(viewer, review);
