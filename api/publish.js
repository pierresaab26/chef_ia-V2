import { authOk, hasRedis, redis, overLimit, clean, callClaude, parseJsonLoose } from "./_lib.js";
import { pidOf, liveRoots } from "./circle.js";
import { notifyCircle } from "./_notify.js";
import { PUB } from "./shared.js";

// v291: « 🌍 Publique » (community plan step 9, first version) + reports (step 8).
// The author publishes the shared copy « s:<sid> » of one of his recipe versions. Conditions:
//  - he tapped « J'ai cuisiné » (or rated it) on that version (rc:<ck> / r:<ck>);
//  - the chef (model) checks it: food, complete, safe; a recipe received from someone (copy with « rs ») must ALSO be a real
//    remix (another dish), not an adjustment (quantities, seasoning, minor swap); and its root author must still share it;
//  - refused → the author can appeal: the recipe waits in the manual queue « pub:queue » (admin link below).
// Published = a FROZEN copy « s:pub-<sid> » (later edits do not change it), listed in the public index « pub:ck »
// (read by the community search and the weekly menu), with the author's nickname. Its circle is notified.
// Reports: 3 different people → hidden from the public index until reviewed.
// Redis: pb:<sid> = {st: public|refused|pending|hidden, ps, reason, at} · pub:rep:<ps> set of reporters · pub:queue (200 last)
// Admin (browser): GET /api/publish?key=<CRON_SECRET> = queue; &approve=<sid> publishes; &remove=<ps> takes a public recipe down.
const pubSid = (sid) => ("pub-" + sid).slice(0, 64);
const REPORTS_TO_HIDE = 3;

export default async function handler(req, res) {
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  const q = req.query || {};
  if (req.method === "GET" && q.key != null) return admin(req, res, q);
  if (!authOk(req, res)) return;
  const owner = clean(req.headers["x-owner"], 60);
  if (!owner || owner.length < 8) return res.status(400).json({ error: "key" });
  const me = pidOf(owner), body = req.body && typeof req.body === "object" ? req.body : {};
  try {
    if (req.method === "GET") { // state of my version: none | public | refused | pending | hidden
      const sid = String(q.state || "");
      if (!/^[a-z0-9-]{8,64}$/.test(sid)) return res.status(400).json({ error: "key" });
      const [raw] = await redis([["GET", "pb:" + sid]]);
      let st = null; try { st = JSON.parse(raw); } catch {}
      return res.status(200).json(st ? { state: st.st, reason: st.reason || "", ps: st.ps || "" } : { state: "none" });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method" });
    const act = String(body.act || "");

    if (act === "report") { // anyone except the author, once per person
      const ps = String(body.sid || "");
      if (!/^pub-[a-z0-9-]{4,60}$/.test(ps)) return res.status(400).json({ error: "key" });
      if (await overLimit(req, "rl:rp:", 10)) return res.status(429).json({ error: "rate" });
      const [raw] = await redis([["GET", "s:" + ps]]);
      let d = null; try { d = JSON.parse(raw); } catch {}
      if (!d) return res.status(404).json({ error: "notfound" });
      if (d.o === owner) return res.status(409).json({ error: "self" });
      const [, n] = await redis([["SADD", "pub:rep:" + ps, me], ["SCARD", "pub:rep:" + ps]]);
      await redis([["LPUSH", "pub:queue", JSON.stringify({ k: "report", ps, t: d.title, n: Number(n), at: Date.now(), why: clean(body.why, 200) })], ["LTRIM", "pub:queue", "0", "199"]]);
      if (Number(n) >= REPORTS_TO_HIDE) {
        await redis([["HDEL", PUB, ps]]);
        if (d.src) await redis([["SET", "pb:" + d.src, JSON.stringify({ st: "hidden", ps, at: Date.now() })]]);
      }
      return res.status(200).json({ ok: true });
    }

    const sid = String(body.sid || "");
    if (!/^[a-z0-9-]{8,64}$/.test(sid) || sid.startsWith("pub-")) return res.status(400).json({ error: "key" });
    const [raw] = await redis([["GET", "s:" + sid]]);
    let d = null; try { d = JSON.parse(raw); } catch {}
    if (!d) return res.status(404).json({ error: "notfound" });
    if (d.o !== owner) return res.status(403).json({ error: "forbidden" }); // only the author of this copy

    if (act === "unpublish") {
      const ps = pubSid(sid);
      await redis([["DEL", "s:" + ps], ["HDEL", PUB, ps], ["DEL", "pb:" + sid], ["DEL", "pub:rep:" + ps]]);
      return res.status(200).json({ ok: true });
    }
    if (act === "appeal") {
      const [st] = await redis([["GET", "pb:" + sid]]);
      let s = null; try { s = JSON.parse(st); } catch {}
      if (!s || s.st !== "refused") return res.status(409).json({ error: "state" });
      await redis([["SET", "pb:" + sid, JSON.stringify({ ...s, st: "pending", at: Date.now() })],
        ["LPUSH", "pub:queue", JSON.stringify({ k: "appeal", sid, t: d.title, reason: s.reason, at: Date.now() })], ["LTRIM", "pub:queue", "0", "199"]]);
      return res.status(200).json({ ok: true, state: "pending" });
    }
    if (act !== "publish") return res.status(400).json({ error: "act" });

    const [r1, r2] = await redis([["HGET", "rc:" + d.ck, owner], ["HGET", "r:" + d.ck, owner]]);
    if (!r1 && !r2) return res.status(409).json({ error: "cook" }); // « J'ai cuisiné » first
    let parent = "";
    if (d.rs) {
      if (!(await liveRoots([d.rs])).has(d.rs)) return res.status(409).json({ error: "gone" }); // its author took it back
      const [pr] = await redis([["GET", "s:" + d.rs]]);
      try { parent = JSON.parse(pr).text || ""; } catch {}
    }
    if (await overLimit(req, "rl:pb:", 5)) return res.status(429).json({ error: "rate" });
    const lang = clean(body.lang || d.lang, 5) || "fr";
    let verdict;
    try { verdict = await review(d, parent, lang); } catch (e) { return res.status(502).json({ error: e && e.code || "upstream" }); }
    if (!verdict.ok) {
      await redis([["SET", "pb:" + sid, JSON.stringify({ st: "refused", reason: verdict.reason, kind: verdict.kind, at: Date.now() })]]);
      return res.status(200).json({ ok: false, state: "refused", reason: verdict.reason });
    }
    const ps = await makePublic(sid, d, me);
    return res.status(200).json({ ok: true, state: "public", ps });
  } catch (e) {
    return res.status(502).json({ error: "storage" });
  }
}

// The frozen public copy + index + circle notification (also used by the admin « approve »).
async function makePublic(sid, d, me) {
  const ps = pubSid(sid);
  const [name] = await redis([["GET", "cu:" + me]]);
  const copy = { title: d.title, text: d.text, ck: d.ck, lang: d.lang, ph: d.ph || null, o: d.o, ts: Date.now(), pub: 1, src: sid, by: name || "", og: d.by || "" };
  await redis([["SET", "s:" + ps, JSON.stringify(copy)], ["HSET", PUB, ps, JSON.stringify({ sid: ps, ck: d.ck, t: d.title, l: d.lang })],
    ["SET", "pb:" + sid, JSON.stringify({ st: "public", ps, at: Date.now() })], ["DEL", "pub:rep:" + ps]]);
  await notifyCircle(me, { k: "pub", sid: ps, t: d.title });
  return ps;
}

const SYS = `You review recipes before they are published in the public community of a cooking app. Answer ONLY with JSON:
{"ok": true|false, "kind": "original"|"remix"|"adjust"|"same"|"invalid", "reason": "<one short, kind sentence for the author, in the language LANG>"}
Accept (ok true) only if ALL hold:
1. It is a real food or drink recipe (not another topic, not a joke, nothing offensive, no personal data, no advertising).
2. It is complete enough to cook: ingredients with quantities and clear steps.
3. It is safe: no dangerous practice (raw or undercooked risky food without warning, toxic ingredients, unsafe preservation).
4. If a PARENT recipe is given: the new one must be a REMIX, i.e. a different dish (main ingredient changed, another technique, another flavour profile such as a vegetarian or fusion version). Only changing quantities, servings, seasoning, a minor swap (butter/oil) or an allergen adaptation is an ADJUSTMENT: refuse with kind "adjust" and say it is too close to the original. Identical: kind "same".
Without a parent, kind is "original" when accepted. The reason explains the refusal, or says briefly why it is accepted.`;

async function review(d, parent, lang) {
  const content = `LANG: ${lang}\n\nRECIPE TO PUBLISH:\n${String(d.text).slice(0, 12000)}` + (parent ? `\n\nPARENT RECIPE (the one it comes from):\n${parent.slice(0, 12000)}` : "\n\n(No parent: the author's own recipe.)");
  const { text } = await callClaude({ model: process.env.MODEL || "claude-haiku-5-5", max_tokens: 2000, system: SYS, content });
  const j = parseJsonLoose(text);
  if (!j || typeof j.ok !== "boolean") throw Object.assign(new Error("upstream"), { code: "upstream" });
  const kind = ["original", "remix", "adjust", "same", "invalid"].includes(j.kind) ? j.kind : (j.ok ? "original" : "invalid");
  const ok = j.ok && (!parent || kind === "remix"); // a received recipe goes public only as a real remix
  return { ok, kind, reason: clean(j.reason, 300) };
}

async function admin(req, res, q) {
  const secret = process.env.CRON_SECRET;
  if (!secret || String(q.key) !== secret) return res.status(401).json({ error: "code" });
  try {
    if (q.approve) {
      const sid = String(q.approve);
      const [raw] = await redis([["GET", "s:" + sid]]);
      let d = null; try { d = JSON.parse(raw); } catch {}
      if (!d) return res.status(404).json({ error: "notfound" });
      const ps = await makePublic(sid, d, pidOf(d.o));
      return res.status(200).json({ ok: true, ps });
    }
    if (q.remove) {
      const ps = String(q.remove);
      const [raw] = await redis([["GET", "s:" + ps]]);
      let d = null; try { d = JSON.parse(raw); } catch {}
      await redis([["HDEL", PUB, ps], ["DEL", "s:" + ps]].concat(d && d.src ? [["SET", "pb:" + d.src, JSON.stringify({ st: "hidden", ps, at: Date.now() })]] : []));
      return res.status(200).json({ ok: true });
    }
    const [list, n] = await redis([["LRANGE", "pub:queue", "0", "99"], ["HLEN", PUB]]);
    return res.status(200).json({ published: Number(n) || 0, queue: (list || []).map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean) });
  } catch { return res.status(502).json({ error: "storage" }); }
}
