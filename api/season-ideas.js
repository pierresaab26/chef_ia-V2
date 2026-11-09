import { authOk, fail, callClaude, hasRedis, redis, overLimit } from "./_lib.js";
import { systemFor, PARTS } from "./chat.js";
import { LANGS, OCC, periodOf, periodById, occasionNowFR, parseIdeas, ideasPrompt, norm } from "./_season.js";

// « Chef's ideas » of the seasonal menu: the SAME 4 ideas (starter, main, dessert, drink) for everybody, renewed every 3 days at 9:00 Paris time.
// - GET /api/season-ideas?lang=fr&occ=automne  (access code like the other routes) → the series of the current period + the 3 previous ones.
//   If the current series does not exist yet (nobody asked since 9:00 and the scheduled run is late), it is generated right now; the first writer wins.
// - GET /api/season-ideas?run=1  → warm-up called by the 2 Vercel crons (vercel.json, UTC: 7:00 and 8:00, so that 9:00 Paris is covered in summer and in winter).
//   Vercel sends « Authorization: Bearer <CRON_SECRET> »: without the CRON_SECRET env var the warm-up does nothing (the series are then generated on first use).
//   It prepares the current French occasion in the 6 languages; other occasions (southern hemisphere, other countries' festivals) are generated on first use.
// An idea that was shown is not proposed again for 3 months (same language, ALL occasions): Redis sorted set sh:<lang> (member = idea name, score = time it was published).
// Redis: si:<lang>:<occasion>:<period> = {items:[[name,sentence]×4], at}, kept 40 days; sh:<lang> = names published in the last 90 days. No Redis → 501 (the app falls back to its own on-demand ideas).

const TTL = 40 * 86400;
const KEEP_PREVIOUS = 3; // earlier series shown in « Previous recipes »
const SEEN_DAYS = 90; // an idea is not proposed again before 3 months
const PROMPT_SEEN = 150; // names sent to the chef as « Not these » (the most recent ones); the check afterwards uses all of them
const key = (lang, occ, id) => `si:${lang}:${occ}:${id}`;
const seenKey = (lang) => `sh:${lang}`;

// Names published in the last 90 days for this language (oldest first); older ones are dropped from Redis on the way.
async function readSeen(lang) {
  const [, names] = await redis([
    ["ZREMRANGEBYSCORE", seenKey(lang), "-inf", String(Date.now() - SEEN_DAYS * 86400000)],
    ["ZRANGE", seenKey(lang), "0", "-1"],
  ]);
  return Array.isArray(names) ? names : [];
}

async function readSeries(lang, occ, ids) {
  const out = await redis(ids.map((id) => ["GET", key(lang, occ, id)]));
  return out.map((s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } });
}

// 4 ideas from the chef, none of them in `banned` (names already published in the last 3 months, previous series included).
// Up to 3 attempts; a slot (starter, main, dessert, drink) whose idea is a repeat is filled from the next attempt, so the order stays right.
async function generate(lang, occ, avoid, banned) {
  const ban = new Set(banned.map(norm));
  const slots = [null, null, null, null];
  const asked = [...avoid];
  for (let attempt = 0; attempt < 3; attempt++) {
    const { text } = await callClaude({
      model: process.env.MODEL || "claude-haiku-5-5",
      max_tokens: 700,
      system: systemFor(PARTS, { lang }),
      messages: [{ role: "user", content: ideasPrompt(occ, asked, lang) }],
    });
    parseIdeas(text).forEach((it, i) => {
      const k = norm(it[0]);
      if (i < 4 && !slots[i] && !ban.has(k)) { slots[i] = it; ban.add(k); }
      else if (!asked.includes(it[0])) asked.push(it[0]);
    });
    if (slots.every(Boolean)) return slots;
  }
  throw Object.assign(new Error("upstream"), { code: "upstream" });
}

// Series of the current period (generated when missing) and the previous ones, for one language and one occasion.
export async function getSeries(lang, occ, per = periodOf()) {
  const ids = [per.id];
  for (let i = 1; i <= KEEP_PREVIOUS; i++) if (per.id - i >= 0) ids.push(per.id - i);
  const [found, seen] = await Promise.all([readSeries(lang, occ, ids), readSeen(lang)]);
  const previous = ids.slice(1).map((id, k) => {
    const p = periodById(id), f = found[k + 1];
    return f && f.items ? { from: p.from, to: p.to, items: f.items } : null;
  }).filter(Boolean);
  let current = found[0] && found[0].items;
  if (!current) {
    const avoid = [...new Set([...previous.flatMap((p) => p.items.map((x) => x[0])), ...seen.slice(-PROMPT_SEEN)])];
    let items;
    try { items = await generate(lang, occ, avoid, [...seen, ...avoid]); }
    catch (e) { // v280: remember why the generation failed, so that /api/season-ideas?status=1 can tell
      try { await redis([["SET", "si:err", JSON.stringify({ at: new Date().toISOString(), lang, occ, period: per.id, code: e && e.code || "?", status: e && e.status || 0, detail: e && e.detail || "" }), "EX", String(7 * 86400)]]); } catch { /* diagnosis only */ }
      throw e;
    }
    const [ok] = await redis([["SET", key(lang, occ, per.id), JSON.stringify({ items, at: Date.now() }), "NX", "EX", TTL]]);
    current = items;
    if (ok === "OK") { // we published it: remember the names for 3 months
      const now = Date.now();
      const cmds = items.map((x, i) => ["ZADD", seenKey(lang), String(now + i), x[0]]);
      cmds.push(["EXPIRE", seenKey(lang), String((SEEN_DAYS + 10) * 86400)]);
      try { await redis(cmds); } catch { /* the series is stored; only the 3-month memory misses these names */ }
      seen.push(...items.map((x) => x[0]));
    }
    if (ok !== "OK") { // somebody else wrote first: everybody must see the same series
      const again = (await readSeries(lang, occ, [per.id]))[0];
      if (again && again.items) current = again.items;
    }
  }
  return { period: per, current, previous, seen: seen.slice(-PROMPT_SEEN) };
}

async function warmup() {
  const per = periodOf(), occ = occasionNowFR();
  const res = await Promise.allSettled(LANGS.map((l) => getSeries(l, occ, per)));
  const out = { period: per.id, occasion: occ, ok: res.filter((r) => r.status === "fulfilled").length, failed: res.filter((r) => r.status === "rejected").length };
  try { await redis([["SET", "si:cron", JSON.stringify({ at: new Date().toISOString(), ...out }), "EX", String(7 * 86400)]]); } catch { /* diagnosis only */ }
  return out;
}

// v280: public health check (booleans, dates and the last error only; no secret): is the series of the current / previous periods stored, did the scheduled run happen, why did a generation fail.
async function status() {
  const per = periodOf(), occ = occasionNowFR();
  const out = { now: new Date().toISOString(), period: { id: per.id, from: per.from, to: per.to }, occasion: occ, anthropicKey: !!process.env.ANTHROPIC_API_KEY, cronSecret: !!process.env.CRON_SECRET, redis: hasRedis() };
  if (!out.redis) return out;
  const parse = (x) => { try { return x ? JSON.parse(x) : null; } catch { return null; } };
  try {
    const ids = [per.id, per.id - 1, per.id - 2].filter((i) => i >= 0);
    const [err, cron, ...ser] = await redis([["GET", "si:err"], ["GET", "si:cron"], ...ids.map((id) => ["GET", key("fr", occ, id)])]);
    out.seriesFR = Object.fromEntries(ids.map((id, k) => [id, !!ser[k]]));
    out.lastCron = parse(cron);
    out.lastError = parse(err);
  } catch { out.redis = false; }
  return out;
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

  if (q.status) return res.status(200).json(await status());
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
