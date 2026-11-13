import { authOk, hasRedis, redis, overLimit } from "./_lib.js";
import { sessionUid } from "./_auth.js";

// v368: sync of the personal data of an ACCOUNT across devices (served as /api/sync by api/circle.js, ?via=sync).
// Delta sync, last write wins per entity. One entity = one field of the hash sy:<uid>:
//   field "<kind>:<id>" (r = recipe, l = shopping list, m = weekly menu, c = circle map, p = publication map)
//   value JSON {u: client time of the last change, t: server counter, d: data | x: 1 for a deletion}
// POST {since, items:[{k,u,d|x}]}: the items are stored when newer (u) than the stored one, then everything changed
// by OTHER pushes after `since` is returned (max PAGE items, `more` = call again with the returned `since`).
const MAX_FIELDS = 3000, MAX_ITEM = 400000, MAX_PUSH = 120, PAGE = 40;
const KEY = /^[rlmcp]:[A-Za-z0-9_.-]{1,64}$/;

export default async function syncHandler(req, res) {
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  if (!(await authOk(req, res))) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const uid = await sessionUid(req);
  if (!uid) return res.status(401).json({ error: "session" });
  if (await overLimit(req, "rl:sy:", 60)) return res.status(429).json({ error: "rate" });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const since = Math.max(0, Number(body.since) || 0);
  const items = Array.isArray(body.items) ? body.items.slice(0, MAX_PUSH) : [];
  const hk = "sy:" + uid;
  try {
    const mine = new Set();
    if (items.length) {
      const valid = items.filter((it) => it && KEY.test(String(it.k || "")) && Number.isFinite(Number(it.u)));
      if (valid.length) {
        const cur = await redis(valid.map((it) => ["HGET", hk, it.k]));
        let n = 0;
        const writes = [];
        for (let i = 0; i < valid.length; i++) {
          const it = valid[i];
          let old = null;
          try { old = cur[i] ? JSON.parse(cur[i]) : null; } catch { old = null; }
          if (old && Number(old.u) >= Number(it.u)) continue; // the stored one is as new or newer: it wins
          const rec = it.x ? { x: 1 } : { d: it.d };
          const raw = JSON.stringify({ u: Number(it.u), ...rec });
          if (raw.length > MAX_ITEM) continue;
          writes.push([it, raw]);
        }
        if (writes.length) {
          const [len] = await redis([["HLEN", hk]]);
          if (Number(len) + writes.length > MAX_FIELDS) return res.status(413).json({ error: "full" });
          const [top] = await redis([["INCRBY", hk + ":c", writes.length]]);
          let t = Number(top) - writes.length;
          const cmds = writes.map(([it, raw]) => { t++; mine.add(it.k); const o = JSON.parse(raw); o.t = t; return ["HSET", hk, it.k, JSON.stringify(o)]; });
          n = cmds.length;
          await redis(cmds);
        }
      }
    }
    const [all] = await redis([["HGETALL", hk]]);
    const out = [];
    let cursor = since, more = false;
    if (Array.isArray(all)) {
      const rows = [];
      for (let i = 0; i + 1 < all.length; i += 2) {
        let o = null;
        try { o = JSON.parse(all[i + 1]); } catch { continue; }
        if (o && Number(o.t) > since && !mine.has(all[i])) rows.push([all[i], o]);
      }
      rows.sort((a, b) => a[1].t - b[1].t);
      for (const [k, o] of rows) {
        if (out.length >= PAGE) { more = true; break; }
        out.push(o.x ? { k, u: o.u, t: o.t, x: 1 } : { k, u: o.u, t: o.t, d: o.d });
        cursor = o.t;
      }
    }
    if (!more) { const [c] = await redis([["GET", hk + ":c"]]); cursor = Math.max(cursor, Number(c) || 0); }
    return res.status(200).json({ items: out, since: cursor, more });
  } catch (e) { return res.status(502).json({ error: "storage" }); }
}
