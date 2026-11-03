import { authOk, fail, callClaude, hasRedis, redis, overLimit } from "./_lib.js";
import { systemFor, PARTS } from "./chat.js";
import { LANGS, OCC, periodOf, periodById, occasionNowFR, parseIdeas, ideasPrompt } from "./_season.js";

// « Chef's ideas » of the seasonal menu: the SAME 4 ideas (starter, main, dessert, drink) for everybody, renewed every 3 days at 9:00 Paris time.
// - GET /api/season-ideas?lang=fr&occ=automne  (access code like the other routes) → the series of the current period + the 3 previous ones.
//   If the current series does not exist yet (nobody asked since 9:00 and the scheduled run is late), it is generated right now; the first writer wins.
// - GET /api/season-ideas?run=1  → warm-up called by the 2 Vercel crons (vercel.json, UTC: 7:00 and 8:00, so that 9:00 Paris is covered in summer and in winter).
//   Vercel sends « Authorization: Bearer <CRON_SECRET> »: without the CRON_SECRET env var the warm-up does nothing (the series are then generated on first use).
//   It prepares the current French occasion in the 6 languages; other occasions (southern hemisphere, other countries' festivals) are generated on first use.
// Redis: si:<lang>:<occasion>:<period> = {items:[[name,sentence]×4], at}, kept 40 days. No Redis → 501 (the app falls back to its own on-demand ideas).

const TTL = 40 * 86400;
const KEEP_PREVIOUS = 3; // earlier series shown in « Previous recipes »
const key = (lang, occ, id) => `si:${lang}:${occ}:${id}`;

async function readSeries(lang, occ, ids) {
  const out = await redis(ids.map((id) => ["GET", key(lang, occ, id)]));
  return out.map((s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } });
}

// 4 ideas from the chef; one retry when he returns fewer than 4 lines.
async function generate(lang, occ, avoid) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text } = await callClaude({
      model: process.env.MODEL || "claude-haiku-5-5",
      max_tokens: 700,
      system: systemFor(PARTS, { lang }),
      messages: [{ role: "user", content: ideasPrompt(occ, avoid) }],
    });
    const items = parseIdeas(text);
    if (items.length === 4) return items;
  }
  throw Object.assign(new Error("upstream"), { code: "upstream" });
}

// Series of the current period (generated when missing) and the previous ones, for one language and one occasion.
export async function getSeries(lang, occ, per = periodOf()) {
  const ids = [per.id];
  for (let i = 1; i <= KEEP_PREVIOUS; i++) if (per.id - i >= 0) ids.push(per.id - i);
  const found = await readSeries(lang, occ, ids);
  const previous = ids.slice(1).map((id, k) => {
    const p = periodById(id), f = found[k + 1];
    return f && f.items ? { from: p.from, to: p.to, items: f.items } : null;
  }).filter(Boolean);
  let current = found[0] && found[0].items;
  if (!current) {
    const avoid = previous.flatMap((p) => p.items.map((x) => x[0]));
    const items = await generate(lang, occ, avoid);
    const [ok] = await redis([["SET", key(lang, occ, per.id), JSON.stringify({ items, at: Date.now() }), "NX", "EX", TTL]]);
    current = items;
    if (ok !== "OK") { // somebody else wrote first: everybody must see the same series
      const again = (await readSeries(lang, occ, [per.id]))[0];
      if (again && again.items) current = again.items;
    }
  }
  return { period: per, current, previous };
}

async function warmup() {
  const per = periodOf(), occ = occasionNowFR();
  const res = await Promise.allSettled(LANGS.map((l) => getSeries(l, occ, per)));
  return { period: per.id, occasion: occ, ok: res.filter((r) => r.status === "fulfilled").length, failed: res.filter((r) => r.status === "rejected").length };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return fail(res, "method");
  const q = req.query || {};
  res.setHeader("Cache-Control", "no-store");

  if (q.run) { // scheduled warm-up
    const secret = process.env.CRON_SECRET;
    if (!secret || (req.headers.authorization || "") !== "Bearer " + secret) return res.status(401).json({ error: "code" });
    if (!hasRedis()) return res.status(501).json({ error: "storage" });
    try { return res.status(200).json(await warmup()); } catch (e) { return fail(res, e.code || "upstream"); }
  }

  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  if (!authOk(req, res)) return;
  const lang = String(q.lang || ""), occ = String(q.occ || "");
  if (!LANGS.includes(lang) || !OCC[occ]) return res.status(400).json({ error: "messages" });
  if (await overLimit(req, "rl:si:", 30)) return fail(res, "rate");
  try {
    return res.status(200).json(await getSeries(lang, occ));
  } catch (e) {
    if (e && e.code) return fail(res, e.code);
    return res.status(502).json({ error: "storage" });
  }
}
