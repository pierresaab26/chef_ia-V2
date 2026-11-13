import { redis } from "./_lib.js";

// v291: in-app notifications of the circle. When someone puts a recipe in « Cercle » or publishes it, every member of his
// circle gets one line in « cn:<pid> » (newest first, 50 kept, 30 days). « cnr:<pid> » = time the member last opened them.
const KEEP = 50, TTL = String(30 * 86400);

export async function notifyCircle(me, item) {
  try {
    const [pids, name, h] = await redis([["SMEMBERS", "cf:" + me], ["GET", "cu:" + me], ["GET", "hp:" + me]]);
    const list = Array.isArray(pids) ? pids.slice(0, 50) : [];
    if (!list.length) return 0;
    const line = JSON.stringify({ k: item.k, sid: item.sid, t: String(item.t || "").slice(0, 120), by: name || "", ...(h ? { bh: h } : {}), at: Date.now() }); // v355: bh = @handle
    await redis(list.flatMap((p) => [["LPUSH", "cn:" + p, line], ["LTRIM", "cn:" + p, "0", String(KEEP - 1)], ["EXPIRE", "cn:" + p, TTL]]));
    return list.length;
  } catch { return 0; } // a notification must never break the share itself
}

// v363: the FOLLOWERS of an author (set « fw:<pid> ») learn that he published. People already in his circle are skipped
// (they got the « pub » note from notifyCircle). Following gives NO access to circle recipes, only to what is published.
export async function notifyFollowers(me, item) {
  try {
    const [fw, cf, name, h] = await redis([["SMEMBERS", "fw:" + me], ["SMEMBERS", "cf:" + me], ["GET", "cu:" + me], ["GET", "hp:" + me]]);
    const circle = new Set(Array.isArray(cf) ? cf : []);
    const list = (Array.isArray(fw) ? fw : []).filter((p) => p !== me && !circle.has(p)).slice(0, 500);
    if (!list.length) return 0;
    const line = JSON.stringify({ k: "fpub", sid: item.sid, t: String(item.t || "").slice(0, 120), by: name || "", ...(h ? { bh: h } : {}), at: Date.now() });
    await redis(list.flatMap((p) => [["LPUSH", "cn:" + p, line], ["LTRIM", "cn:" + p, "0", String(KEEP - 1)], ["EXPIRE", "cn:" + p, TTL]]));
    return list.length;
  } catch { return 0; }
}

// v301: a note for ONE person (the author of an appeal gets the answer of the review).
export async function notifyOne(pid, item) {
  try {
    if (!pid) return 0;
    const line = JSON.stringify({ k: item.k, sid: item.sid || "", t: String(item.t || "").slice(0, 120), by: String(item.by || "").slice(0, 24), at: Date.now(), ...(item.bh ? { bh: item.bh } : {}), ...(item.p ? { p: item.p } : {}), ...(item.x ? { x: String(item.x).slice(0, 160) } : {}), ...(item.ck ? { ck: String(item.ck).slice(0, 60) } : {}), ...(item.m ? { m: String(item.m).slice(0, 300) } : {}) }); // v302: m = moderator's comment; v358: by / bh / p for circle requests
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
