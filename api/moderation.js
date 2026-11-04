// Moderation log (users blocked after too many silly / dangerous requests).
// GET /api/moderation?key=<CRON_SECRET> → the last entries, newest first. Same secret as the crons.
// &unblock=<id> (id shown in the log / email) lifts the block and resets the counters of that user (IP + device);
// &unblock=all lifts every block and resets every counter.
import { fail, redis, hasRedis } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return fail(res, "method");
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail(res, "nokey");
  const key = String((req.query && req.query.key) || "");
  if (key !== secret) return res.status(401).json({ error: "code" });
  if (!hasRedis()) return fail(res, "storage");
  const un = String((req.query && req.query.unblock) || "");
  try {
    if (un) return res.status(200).json(await unblock(un));
    const [rows] = await redis([["LRANGE", "mod:log", 0, 99]]);
    return res.status(200).json({ count: rows.length, entries: rows.map((r) => { try { return JSON.parse(r); } catch { return r; } }) });
  } catch {
    return fail(res, "storage");
  }
}

async function unblock(un) {
  const keys = [];
  if (un === "all") {
    for (const pat of ["bk:*", "fl:*"]) {
      let cur = "0";
      do {
        const [r] = await redis([["SCAN", cur, "MATCH", pat, "COUNT", 200]]);
        cur = String(r[0]);
        keys.push(...r[1]);
      } while (cur !== "0");
    }
  } else if (/^[a-f0-9]{16}$/.test(un)) {
    const [rows] = await redis([["LRANGE", "mod:log", 0, 199]]);
    let ids = [un];
    for (const r of rows) {
      try { const e = JSON.parse(r); if (e.id === un || (e.ids || []).includes(un)) ids = [...new Set([...ids, e.id, ...(e.ids || [])])]; } catch {}
    }
    for (const i of ids) keys.push("bk:" + i, "fl:" + i, "fl:sent:" + i, "fl:last:" + i);
  } else {
    return { error: "id" };
  }
  for (let i = 0; i < keys.length; i += 100) await redis(keys.slice(i, i + 100).map((k) => ["DEL", k]));
  return { unblocked: un, keysCleared: keys.length };
}
