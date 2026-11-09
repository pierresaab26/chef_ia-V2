import { createHash, randomBytes } from "node:crypto";
import { authOk, hasRedis, redis, overLimit, clean } from "./_lib.js";

// v287: identity (pseudo) and circle (community plan steps 6 and 7).
// A person = the device owner id sent as « x-owner » (never stored nor returned: only its hash « pid » is).
// Everyone has ONE circle: an invite link /?c=<code> (7 days) puts the two people in each other's circle.
// A recipe put in « Cercle » = its shared copy « s:<sid> » (api/shared.js) listed in the author's « cp:<pid> »;
// the circle feed = the recipes listed by the people of my circle.
// Redis: cu:<pid> pseudo · cf:<pid> set of circle pids · ci:<code> invite → pid (7 days) · cp:<pid> zset sid → time (max 100)
const MAX_CIRCLE = 50, MAX_POSTS = 100, FEED = 60, INVITE_TTL = 7 * 86400;
export const pidOf = (owner) => createHash("sha256").update("circle|" + owner).digest("hex").slice(0, 16);
export const cleanName = (s) => clean(s, 24).replace(/[<>"]/g, "").replace(/\s+/g, " ");

export default async function handler(req, res) {
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  if (!authOk(req, res)) return;
  const owner = clean(req.headers["x-owner"], 60);
  if (!owner || owner.length < 8) return res.status(400).json({ error: "key" });
  if (await overLimit(req, "rl:ci:", 40)) return res.status(429).json({ error: "rate" });
  const me = pidOf(owner), q = req.query || {};
  const body = req.body && typeof req.body === "object" ? req.body : {};
  try {
    if (req.method === "GET") {
      if (q.feed) return res.status(200).json({ items: await feed(me) });
      if (q.live != null) { // v288: are these recipes (saved from my circle) still shared by someone of my circle?
        const sids = String(q.live).split(",").filter((x) => /^[a-z0-9-]{8,64}$/.test(x)).slice(0, 20);
        const [pids] = await redis([["SMEMBERS", "cf:" + me]]);
        const list = Array.isArray(pids) ? pids.slice(0, MAX_CIRCLE) : [];
        const live = {};
        if (sids.length && list.length) {
          const sc = await redis(sids.flatMap((sid) => list.map((p) => ["ZSCORE", "cp:" + p, sid])));
          sids.forEach((sid, i) => { live[sid] = sc.slice(i * list.length, (i + 1) * list.length).some((v) => v != null); });
        } else sids.forEach((sid) => { live[sid] = false; });
        return res.status(200).json({ live });
      }
      return res.status(200).json(await whoami(me));
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method" });
    const act = String(body.act || "");

    if (act === "name") {
      const n = cleanName(body.name);
      if (!n) return res.status(400).json({ error: "name" });
      await redis([["SET", "cu:" + me, n]]);
      return res.status(200).json({ ok: true, name: n });
    }
    if (act === "invite") {
      const code = randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12).padEnd(12, "0");
      await redis([["SET", "ci:" + code, me, "EX", String(INVITE_TTL)]]);
      return res.status(200).json({ code });
    }
    if (act === "join") {
      const code = String(body.code || "");
      if (!/^[a-z0-9]{8,16}$/.test(code)) return res.status(400).json({ error: "key" });
      const [other, mine] = await redis([["GET", "ci:" + code], ["SCARD", "cf:" + me]]);
      if (!other) return res.status(404).json({ error: "notfound" }); // expired or wrong link
      if (other === me) return res.status(409).json({ error: "self" });
      const [already, theirs] = await redis([["SISMEMBER", "cf:" + me, other], ["SCARD", "cf:" + other]]);
      if (!already && (Number(mine) >= MAX_CIRCLE || Number(theirs) >= MAX_CIRCLE)) return res.status(409).json({ error: "full" });
      const [, , name] = await redis([["SADD", "cf:" + me, other], ["SADD", "cf:" + other, me], ["GET", "cu:" + other]]);
      return res.status(200).json({ ok: true, already: !!Number(already), name: name || "" });
    }
    if (act === "remove") {
      const p = String(body.pid || "");
      if (!/^[a-f0-9]{16}$/.test(p)) return res.status(400).json({ error: "key" });
      await redis([["SREM", "cf:" + me, p], ["SREM", "cf:" + p, me]]); // both sides: nobody stays in a circle he left
      return res.status(200).json({ ok: true });
    }
    if (act === "post" || act === "unpost") {
      const sid = String(body.sid || "");
      if (!/^[a-z0-9-]{8,64}$/.test(sid)) return res.status(400).json({ error: "key" });
      if (act === "unpost") { await redis([["ZREM", "cp:" + me, sid]]); return res.status(200).json({ ok: true }); }
      const [raw] = await redis([["GET", "s:" + sid]]);
      let o = null; try { o = JSON.parse(raw).o; } catch {}
      if (!raw) return res.status(404).json({ error: "notfound" });
      if (o !== owner) return res.status(403).json({ error: "forbidden" }); // only the author puts his own copy in his circle
      await redis([["ZADD", "cp:" + me, String(Date.now()), sid], ["ZREMRANGEBYRANK", "cp:" + me, "0", String(-MAX_POSTS - 1)]]);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "act" });
  } catch (e) {
    return res.status(502).json({ error: "storage" });
  }
}

async function whoami(me) {
  const [name, pids] = await redis([["GET", "cu:" + me], ["SMEMBERS", "cf:" + me]]);
  const list = Array.isArray(pids) ? pids.slice(0, MAX_CIRCLE) : [];
  const names = list.length ? await redis(list.map((p) => ["GET", "cu:" + p])) : [];
  return { name: name || "", members: list.map((p, i) => ({ pid: p, name: names[i] || "" })).sort((a, b) => a.name.localeCompare(b.name)) };
}

// Recipes put in « Cercle » by the people of my circle, newest first. A copy deleted by its author (s:<sid> gone) is dropped.
async function feed(me) {
  const [pids] = await redis([["SMEMBERS", "cf:" + me]]);
  const list = Array.isArray(pids) ? pids.slice(0, MAX_CIRCLE) : [];
  if (!list.length) return [];
  const out = await redis(list.flatMap((p) => [["ZREVRANGE", "cp:" + p, "0", "29", "WITHSCORES"], ["GET", "cu:" + p]]));
  const posts = [];
  list.forEach((p, i) => {
    const z = out[i * 2] || [], by = out[i * 2 + 1] || "";
    for (let k = 0; k + 1 < z.length; k += 2) posts.push({ sid: z[k], at: Number(z[k + 1]) || 0, by, pid: p });
  });
  posts.sort((a, b) => b.at - a.at);
  const top = posts.slice(0, FEED);
  if (!top.length) return [];
  const raws = await redis(top.map((x) => ["GET", "s:" + x.sid]));
  return top.map((x, i) => {
    try { const d = JSON.parse(raws[i]); return { sid: x.sid, t: String(d.title || "").slice(0, 120), l: d.lang || "", by: x.by, at: x.at, ph: d.ph && d.ph.t ? { t: d.ph.t } : null }; } catch { return null; }
  }).filter(Boolean);
}
