import { redis } from "./_lib.js";

// v291: in-app notifications of the circle. When someone puts a recipe in « Cercle » or publishes it, every member of his
// circle gets one line in « cn:<pid> » (newest first, 50 kept, 30 days). « cnr:<pid> » = time the member last opened them.
const KEEP = 50, TTL = String(30 * 86400);

export async function notifyCircle(me, item) {
  try {
    const [pids, name] = await redis([["SMEMBERS", "cf:" + me], ["GET", "cu:" + me]]);
    const list = Array.isArray(pids) ? pids.slice(0, 50) : [];
    if (!list.length) return 0;
    const line = JSON.stringify({ k: item.k, sid: item.sid, t: String(item.t || "").slice(0, 120), by: name || "", at: Date.now() });
    await redis(list.flatMap((p) => [["LPUSH", "cn:" + p, line], ["LTRIM", "cn:" + p, "0", String(KEEP - 1)], ["EXPIRE", "cn:" + p, TTL]]));
    return list.length;
  } catch { return 0; } // a notification must never break the share itself
}

// v301: a note for ONE person (the author of an appeal gets the answer of the review).
export async function notifyOne(pid, item) {
  try {
    if (!pid) return 0;
    const line = JSON.stringify({ k: item.k, sid: item.sid || "", t: String(item.t || "").slice(0, 120), by: "", at: Date.now() });
    await redis([["LPUSH", "cn:" + pid, line], ["LTRIM", "cn:" + pid, "0", String(KEEP - 1)], ["EXPIRE", "cn:" + pid, TTL]]);
    return 1;
  } catch { return 0; }
}

export async function readNotes(me) {
  const [raw, seen] = await redis([["LRANGE", "cn:" + me, "0", String(KEEP - 1)], ["GET", "cnr:" + me]]);
  const items = (raw || []).map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
  const last = Number(seen) || 0;
  return { items, unread: items.filter((x) => x.at > last).length, seen: last };
}

export async function markSeen(me) {
  await redis([["SET", "cnr:" + me, String(Date.now()), "EX", TTL]]);
}
