import { redis, overLimit } from "./_lib.js";
import { notifyOne } from "./_notify.js";

// v369: « famille » status + shared shopping lists (served by api/circle.js, no new route).
// Redis: fm:<pid> set of my family pids (mutual) · fq:<target> hash requester pid → time (pending family requests, 30 days)
//        sl:<id> JSON {id, o: owner pid, name, nts, items:[{k, i, ts}], gone:{k: ts}, v, m:[pids]} · sm:<pid> set of list ids I am in.
// A shared list is merged item by item (key = lower-case item text, ts = SERVER time of its last change (v370: client clocks are never trusted); a deleted item is
// remembered in « gone »). Every change bumps v; clients poll GET ?sl=<id>&v=<v> (cheap « same »).
const MAX_FAM = 30, MAX_ITEMS = 300, MAX_MEMBERS = 8, MAX_LISTS = 30, ID = /^[A-Za-z0-9_.-]{4,40}$/, PID = /^[a-f0-9]{16}$/;
const cut = (s, n) => String(s == null ? "" : s).slice(0, n);

async function load(id) { const [raw] = await redis([["GET", "sl:" + id]]); try { return raw ? JSON.parse(raw) : null; } catch { return null; } }
const save = (l) => redis([["SET", "sl:" + l.id, JSON.stringify(l), "EX", String(400 * 86400)]]);
async function names(pids) {
  if (!pids.length) return [];
  const r = await redis(pids.flatMap((p) => [["GET", "cu:" + p], ["GET", "hp:" + p]]));
  return pids.map((p, i) => ({ pid: p, name: r[i * 2] || "", h: r[i * 2 + 1] || "" }));
}
const state = async (l, me) => ({ id: l.id, name: l.name, nts: l.nts || 0, v: l.v, mine: l.o === me, items: l.items, gone: l.gone, members: await names(l.m) });

function cleanItem(it) {
  if (!it || typeof it !== "object") return null;
  const k = cut(it.k, 200).toLowerCase().trim(), ts = Number(it.ts);
  if (!k || !Number.isFinite(ts)) return null;
  const i = it.i && typeof it.i === "object" ? it.i : null;
  if (!i || JSON.stringify(i).length > 3000) return null;
  return { k, i, ts };
}
function merge(l, items, gone) {
  // v370: the SERVER decides the order of changes (its own clock), never the clients' clocks: every item or deletion a client sends is
  // a change it made on purpose (it only sends what differs from its last sync), so it is applied and stamped now.
  let changed = false;
  const now = Date.now();
  for (const raw of items.slice(0, MAX_ITEMS)) {
    const it = cleanItem(raw); if (!it) continue;
    const at = l.items.findIndex((x) => x.k === it.k);
    if (at >= 0) {
      if (JSON.stringify(l.items[at].i) === JSON.stringify(it.i)) continue;
      l.items[at] = { k: it.k, i: it.i, ts: Math.max(now, l.items[at].ts + 1) }; changed = true;
    } else if (l.items.length < MAX_ITEMS) { l.items.push({ k: it.k, i: it.i, ts: now }); delete l.gone[it.k]; changed = true; }
  }
  for (const k0 of Object.keys(gone && typeof gone === "object" ? gone : {}).slice(0, MAX_ITEMS)) {
    const k = cut(k0, 200).toLowerCase().trim(); if (!k) continue;
    const at = l.items.findIndex((x) => x.k === k);
    if (at >= 0) { l.items.splice(at, 1); l.gone[k] = now; changed = true; }
  }
  const keys = Object.keys(l.gone);
  if (keys.length > MAX_ITEMS) keys.sort((a, b) => l.gone[a] - l.gone[b]).slice(0, keys.length - MAX_ITEMS).forEach((k) => delete l.gone[k]);
  return changed;
}

export async function famGet(q, me, res) {
  if (q.sls != null) {
    const [ids] = await redis([["SMEMBERS", "sm:" + me]]);
    const out = [];
    for (const id of (Array.isArray(ids) ? ids : []).slice(0, MAX_LISTS)) {
      const l = await load(id);
      if (!l || !l.m.includes(me)) { await redis([["SREM", "sm:" + me, id]]); continue; }
      out.push({ id, name: l.name, v: l.v, mine: l.o === me });
    }
    return res.status(200).json({ lists: out });
  }
  const id = String(q.sl || "");
  if (!ID.test(id)) return res.status(400).json({ error: "key" });
  const l = await load(id);
  if (!l || !l.m.includes(me)) return res.status(404).json({ error: "gone" });
  if (q.v != null && Number(q.v) === l.v) return res.status(200).json({ same: true, v: l.v });
  return res.status(200).json(await state(l, me));
}

export async function famAct(act, body, me, res, ctx) {
  if (!(await ctx.socialOk())) return res.status(401).json({ error: "session" });
  const [myName, myH] = await redis([["GET", "cu:" + me], ["GET", "hp:" + me]]);
  if (act === "fam_ask" || act === "fam_accept" || act === "fam_decline" || act === "fam_remove") {
    const p = String(body.pid || "");
    if (!PID.test(p) || p === me) return res.status(400).json({ error: "key" });
    if (act === "fam_decline") { await redis([["HDEL", "fq:" + me, p]]); return res.status(200).json({ ok: true }); }
    if (act === "fam_remove") {
      await redis([["SREM", "fm:" + me, p], ["SREM", "fm:" + p, me]]);
      const [ids] = await redis([["SMEMBERS", "sm:" + me]]);
      for (const id of (Array.isArray(ids) ? ids : []).slice(0, MAX_LISTS)) {
        const l = await load(id); if (!l) continue;
        const gone = l.o === me ? p : l.o === p ? me : "";
        if (!gone || !l.m.includes(gone)) continue;
        l.m = l.m.filter((x) => x !== gone); l.v++; await save(l); await redis([["SREM", "sm:" + gone, id]]);
      }
      return res.status(200).json({ ok: true });
    }
    const link = async () => {
      const [n1, n2] = await redis([["SCARD", "fm:" + me], ["SCARD", "fm:" + p]]);
      if (Number(n1) >= MAX_FAM || Number(n2) >= MAX_FAM) return false;
      await redis([["SADD", "fm:" + me, p], ["SADD", "fm:" + p, me], ["HDEL", "fq:" + me, p], ["HDEL", "fq:" + p, me]]);
      await notifyOne(p, { k: "famok", by: myName || "", bh: myH || "", p: me });
      return true;
    };
    if (act === "fam_accept") {
      const [asked] = await redis([["HEXISTS", "fq:" + me, p]]);
      if (!Number(asked)) return res.status(404).json({ error: "notfound" });
      return (await link()) ? res.status(200).json({ ok: true, state: "fam" }) : res.status(409).json({ error: "full" });
    }
    const [inC, fam, theyAsked, hp] = await redis([["SISMEMBER", "cf:" + me, p], ["SISMEMBER", "fm:" + me, p], ["HEXISTS", "fq:" + me, p], ["GET", "hp:" + p]]);
    if (!Number(inC) || !hp) return res.status(403).json({ error: "circle" }); // family is chosen among the people of my circle (with an @)
    if (Number(fam)) return res.status(200).json({ ok: true, state: "fam" });
    if (Number(theyAsked)) return (await link()) ? res.status(200).json({ ok: true, state: "fam" }) : res.status(409).json({ error: "full" });
    if (await overLimit(ctx.req, "rl:fq:", 20)) return res.status(429).json({ error: "rate" });
    const [was] = await redis([["HEXISTS", "fq:" + p, me]]);
    await redis([["HSET", "fq:" + p, me, String(Date.now())], ["EXPIRE", "fq:" + p, String(30 * 86400)]]);
    if (!Number(was)) await notifyOne(p, { k: "famreq", by: myName || "", bh: myH || "", p: me });
    return res.status(200).json({ ok: true, state: "sent" });
  }
  const id = String(body.id || "");
  if (!ID.test(id)) return res.status(400).json({ error: "key" });
  if (act === "sl_share") {
    let l = await load(id);
    if (l && l.o !== me) return res.status(403).json({ error: "forbidden" });
    const want = (Array.isArray(body.with) ? body.with : []).map(String).filter((p) => PID.test(p) && p !== me).slice(0, MAX_MEMBERS);
    const ok = want.length ? await redis(want.map((p) => ["SISMEMBER", "fm:" + me, p])) : [];
    const fam = want.filter((p, i) => Number(ok[i]));
    if (!fam.length) return res.status(403).json({ error: "family" });
    if (!l) {
      const [n] = await redis([["SCARD", "sm:" + me]]);
      if (Number(n) >= MAX_LISTS) return res.status(409).json({ error: "full" });
      l = { id, o: me, name: cut(body.name, 80) || "Liste", nts: Date.now(), items: [], gone: {}, v: 1, m: [me] };
      merge(l, Array.isArray(body.items) ? body.items : [], {});
    }
    const added = fam.filter((p) => !l.m.includes(p));
    if (l.m.length + added.length > MAX_MEMBERS) return res.status(409).json({ error: "full" });
    l.m.push(...added); l.v++;
    await save(l);
    await redis([["SADD", "sm:" + me, id], ...added.map((p) => ["SADD", "sm:" + p, id])]);
    for (const p of added) await notifyOne(p, { k: "slsh", by: myName || "", bh: myH || "", p: me, t: l.name });
    return res.status(200).json(await state(l, me));
  }
  const l = await load(id);
  if (!l || !l.m.includes(me)) return res.status(404).json({ error: "gone" });
  if (act === "sl_sync") {
    const ch = merge(l, Array.isArray(body.items) ? body.items : [], body.gone);
    const nm = cut(body.name, 80);
    let rn = false;
    if (nm && nm !== l.name) { l.name = nm; l.nts = Date.now(); rn = true; }
    if (ch || rn) { l.v++; await save(l); }
    return res.status(200).json(await state(l, me));
  }
  if (act === "sl_leave") {
    if (l.o === me) { await redis([["DEL", "sl:" + id], ...l.m.map((p) => ["SREM", "sm:" + p, id])]); return res.status(200).json({ ok: true, ended: true }); }
    l.m = l.m.filter((p) => p !== me); l.v++; await save(l); await redis([["SREM", "sm:" + me, id]]);
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: "act" });
}
