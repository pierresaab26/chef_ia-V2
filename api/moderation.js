// Moderation log (users blocked after too many silly / dangerous requests).
// GET /api/moderation?key=<CRON_SECRET> → the last entries, newest first. Same secret as the crons.
import { fail, redis, hasRedis } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return fail(res, "method");
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail(res, "nokey");
  const key = String((req.query && req.query.key) || "");
  if (key !== secret) return res.status(401).json({ error: "code" });
  if (!hasRedis()) return fail(res, "storage");
  try {
    const [rows] = await redis([["LRANGE", "mod:log", 0, 99]]);
    return res.status(200).json({ count: rows.length, entries: rows.map((r) => { try { return JSON.parse(r); } catch { return r; } }) });
  } catch {
    return fail(res, "storage");
  }
}
