// Moderation safety: counts « silly / dangerous / illegal » requests (marker sent by the chef, see _flags.js),
// blocks after FLAG_BLOCK of them in 7 days and tells the moderation (email through Resend + a log in Redis).
// Everything fails open: if Redis is missing or slow, the chat simply works without the safety.
import { createHash } from "node:crypto";
import { redis, hasRedis } from "./_lib.js";
import { FLAG_BLOCK, FLAG_WEEK, FLAG_BLOCK_S } from "./_flags.js";

const hid = (s) => createHash("sha256").update("chefia|" + s).digest("hex").slice(0, 16);

// Who is asking: hashed IP + random device id from the browser (nothing readable is stored).
export function who(req, body) {
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const d = body && typeof body.dev === "string" && /^[a-z0-9]{8,40}$/i.test(body.dev) ? body.dev : "";
  return { ip: ip ? hid(ip) : "", dev: d ? hid(d) : "" };
}

export async function isBanned(w) {
  if (!hasRedis()) return false;
  const keys = [w.ip && "bk:" + w.ip, w.dev && "bk:" + w.dev].filter(Boolean);
  if (!keys.length) return false;
  try {
    const r = await redis(keys.map((k) => ["GET", k]));
    return r.some(Boolean);
  } catch {
    return false;
  }
}

// Counts one flagged request. Returns { n } = highest count of the two identities, and notifies at the block.
export async function recordFlag(w, kind, request, lang) {
  if (!hasRedis()) return { n: 0 };
  const ids = [w.ip, w.dev].filter(Boolean);
  if (!ids.length) return { n: 0 };
  try {
    const last = kind + "|" + String(request || "").replace(/\s+/g, " ").slice(0, 200);
    const c = await redis(ids.map((i) => ["INCR", "fl:" + i]));
    const cmds = [];
    ids.forEach((i, x) => { if (Number(c[x]) === 1) cmds.push(["EXPIRE", "fl:" + i, FLAG_WEEK]); });
    cmds.push(["LPUSH", "fl:last:" + ids[0], last], ["LTRIM", "fl:last:" + ids[0], 0, 9], ["EXPIRE", "fl:last:" + ids[0], FLAG_WEEK]);
    await redis(cmds);
    const n = Math.max(...c.map(Number));
    if (n >= FLAG_BLOCK) {
      await redis(ids.map((i) => ["SET", "bk:" + i, "1", "EX", FLAG_BLOCK_S]));
      const [first] = await redis([["SET", "fl:sent:" + ids[0], "1", "EX", FLAG_WEEK, "NX"]]);
      if (first) await notify(ids[0], n, lang);
    }
    return { n };
  } catch {
    return { n: 0 };
  }
}

async function notify(id, n, lang) {
  let lastReq = [];
  try { [lastReq] = await redis([["LRANGE", "fl:last:" + id, 0, 9]]); } catch {}
  const entry = { at: new Date().toISOString(), id, count: n, lang: String(lang || "").slice(0, 5), blockedHours: FLAG_BLOCK_S / 3600, last: lastReq };
  try { await redis([["LPUSH", "mod:log", JSON.stringify(entry)], ["LTRIM", "mod:log", 0, 199]]); } catch {}
  const key = process.env.RESEND_API_KEY, to = process.env.MOD_EMAIL;
  if (!key || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.MOD_FROM || "Chef IA <onboarding@resend.dev>",
        to: [to],
        subject: "Chef IA : utilisateur bloqué (" + n + " demandes non conformes)",
        text: "Un utilisateur (id " + id + ", langue " + entry.lang + ") a envoyé " + n + " demandes farfelues, dangereuses ou illégales en 7 jours.\nIl est bloqué " + entry.blockedHours + " h.\n\nDernières demandes (type|texte) :\n" + lastReq.join("\n"),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}
