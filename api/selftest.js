import { callClaude, redis, hasRedis, parseJsonLoose } from "./_lib.js";
import { systemFor, PARTS } from "./chat.js";
import { CASES } from "./_selftest-cases.js";

// Daily « food only » self-test of the chef (55 questions, same model and same instructions as /api/chat).
// - Run: called by the 2 Vercel crons (vercel.json), each one runs half of the questions (?run=1&part=1|2).
//   Vercel sends « Authorization: Bearer <CRON_SECRET> »: without the CRON_SECRET env var, nothing runs.
// - Report: GET /api/selftest (no secret) returns the last full report and the last 30 days (no answers, just results).
// Redis keys: st:<day>:p1 / st:<day>:p2 (part results, kept 3 days), st:last (last full report), st:hist (last 30 reports).

const MODEL = () => process.env.MODEL || "claude-haiku-5-5";
const day = () => new Date().toISOString().slice(0, 10);

// The chef's standard refusal always names « Chef IA » (template in api/chat.js) and is short.
const isRefusal = (t) => /Chef IA/i.test(t) && t.length < 700 && !/```/.test(t);

const JUDGE =
  'You check a cooking assistant that must only handle food, cooking and drinks. The user message mixes a food question and a non-food question. Reply with JSON only: {"did_offtopic":bool,"gave_food_help":bool}. did_offtopic = the answer actually answers or helps with the NON-food part (a short sentence saying it only handles cooking does not count). gave_food_help = the answer gives useful help on the food part.';

async function check(c) {
  const system = [{ type: "text", text: systemFor(PARTS, { lang: c.lang, mode: c.mode }), cache_control: { type: "ephemeral" } }];
  const r = { id: c.id, cat: c.cat, expect: c.expect, mode: c.mode, q: c.msgs[c.msgs.length - 1].content.slice(0, 160) };
  try {
    const { text } = await callClaude({ model: MODEL(), max_tokens: 700, system, messages: c.msgs });
    const t = text.trim();
    if (c.expect === "refuse") r.pass = isRefusal(t);
    else if (c.expect === "answer") r.pass = !isRefusal(t) && t.length > 40;
    else {
      const j = await callClaude({ model: MODEL(), max_tokens: 120, system: JUDGE, content: "USER:\n" + r.q + "\n\nANSWER:\n" + t });
      const v = parseJsonLoose(j.text) || {};
      r.pass = !!v.gave_food_help && !v.did_offtopic;
    }
    if (!r.pass) r.answer = t.slice(0, 400);
  } catch (e) {
    r.pass = false;
    r.error = e.code || "error";
  }
  return r;
}

async function runPart(part) {
  const list = CASES.filter((_, i) => i % 2 === part - 1);
  const out = [];
  const queue = [...list];
  await Promise.all([0, 1, 2, 3].map(async () => { while (queue.length) out.push(await check(queue.shift())); }));
  return out;
}

export default async function handler(req, res) {
  const q = req.query || {};
  if (req.method !== "GET") return res.status(405).json({ error: "method" });
  if (!hasRedis()) return res.status(501).json({ error: "noredis" });

  if (!q.run) { // public report
    const [last, hist] = await redis([["GET", "st:last"], ["LRANGE", "st:hist", 0, 29]]);
    return res.status(200).json({ last: last ? JSON.parse(last) : null, history: (hist || []).map((h) => JSON.parse(h)) });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(501).json({ error: "nocron" });
  if ((req.headers.authorization || "") !== "Bearer " + secret) return res.status(401).json({ error: "code" });
  const part = q.part === "2" ? 2 : 1;
  const d = day();
  const results = await runPart(part);
  await redis([["SET", "st:" + d + ":p" + part, JSON.stringify(results), "EX", 259200]]);

  // both halves done today → full report
  const [p1, p2] = await redis([["GET", "st:" + d + ":p1"], ["GET", "st:" + d + ":p2"]]);
  if (p1 && p2) {
    const all = [...JSON.parse(p1), ...JSON.parse(p2)];
    const fails = all.filter((x) => !x.pass);
    const report = { date: d, model: MODEL(), ok: all.length - fails.length, total: all.length, errors: fails.filter((x) => x.error).length, fails };
    await redis([["SET", "st:last", JSON.stringify(report)], ["LPUSH", "st:hist", JSON.stringify({ date: d, ok: report.ok, total: report.total })], ["LTRIM", "st:hist", 0, 29]]);
  }
  return res.status(200).json({ part, done: results.length, ok: results.filter((x) => x.pass).length });
}
