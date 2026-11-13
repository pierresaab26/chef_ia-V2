// Moderation log (users blocked after too many silly / dangerous requests).
// GET /api/moderation?key=<CRON_SECRET> → the last entries, newest first. Same secret as the crons.
// &unblock=<id> (id shown in the log / email) lifts the block and resets the counters of that user (IP + device);
// &unblock=all lifts every block and resets every counter.
// v320 invitation links (one per friend, revocable; the shared code APP_PASSWORD stays private):
//   &invite=<name>   → creates a personal link  https://<site>/?k=<token>  (answer: {name, link})
//   &invites=1       → lists the invitations (name, date, link)
//   &revoke=<name>   → removes every invitation of that name (or the one whose token is given); effective within 60 s
// &stats=1 → counts of users (there are no accounts: a user = a device nickname) and activity, read-only.
import { fail, redis, hasRedis } from "./_lib.js";
import { randomBytes } from "node:crypto";
import { suggest, handleOk } from "./_auth.js";
import { indexPerson } from "./_index.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return fail(res, "method");
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail(res, "nokey");
  const key = String((req.query && req.query.key) || "");
  if (key !== secret) return res.status(401).json({ error: "code" });
  if (!hasRedis()) return fail(res, "storage");
  const un = String((req.query && req.query.unblock) || "");
  const q = req.query || {};
  try {
    if (q.stats) return res.status(200).json(await stats());
    if (q.creports || q.cok || q.cdel || q.cunban) return res.status(200).json(await commentReports(q));
    if (q.handles) return res.status(200).json(await deviceHandles(!!q.apply));
    if (q.invite || q.invites || q.revoke) return res.status(200).json(await invites(q, req));
    if (un) return res.status(200).json(await unblock(un));
    const [rows] = await redis([["LRANGE", "mod:log", 0, 99]]);
    return res.status(200).json({ count: rows.length, entries: rows.map((r) => { try { return JSON.parse(r); } catch { return r; } }) });
  } catch {
    return fail(res, "storage");
  }
}

// Number of keys matching a pattern (SCAN, capped at 50 000 keys).
async function countKeys(pat) {
  let cur = "0", n = 0, loops = 0;
  do {
    const [r] = await redis([["SCAN", cur, "MATCH", pat, "COUNT", 500]]);
    cur = String(r[0]);
    n += r[1].length;
  } while (cur !== "0" && ++loops < 100);
  return n;
}

// No accounts exist: "users" = devices that picked a nickname (cu:<pid>). Invitations = personal access links (hash ak).
async function stats() {
  const [[invitations], nicknames, inCircle, sharedAll, publicCopies] = await Promise.all([
    redis([["HLEN", "ak"]]),
    countKeys("cu:*"),
    countKeys("cf:*"),
    countKeys("s:*"),
    countKeys("s:pub-*"),
  ]);
  return {
    users: nicknames, // devices with a nickname (the closest thing to "registered")
    inCircle, // of those, how many have at least one circle member
    invitations: Number(invitations) || 0, // personal access links still active
    sharedRecipes: Math.max(0, sharedAll - publicCopies),
    publicRecipes: publicCopies,
    note: "No accounts: a user is a device nickname. People who only use the shared code and never pick a nickname are not counted.",
  };
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

const nameOf = (x) => String(x || "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 40);
async function invites(q, req) {
  const origin = "https://" + String((req && req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) || "chefia-v3.vercel.app");
  const rows = async () => {
    const [h] = await redis([["HGETALL", "ak"]]);
    const out = [];
    for (let i = 0; i < (h || []).length; i += 2) {
      let v = {}; try { v = JSON.parse(h[i + 1]); } catch {}
      out.push({ token: h[i], name: v.n || "", at: v.at || 0 });
    }
    return out.sort((a, b) => b.at - a.at);
  };
  if (q.revoke) {
    const w = String(q.revoke).trim().toLowerCase();
    const del = (await rows()).filter((r) => r.token === w || r.name.toLowerCase() === w);
    if (del.length) await redis(del.map((r) => ["HDEL", "ak", r.token]));
    return { revoked: del.map((r) => r.name), count: del.length };
  }
  if (q.invite) {
    const name = nameOf(q.invite);
    if (!name) return { error: "name" };
    if ((await rows()).length >= 500) return { error: "limit" }; // v323: friends links live here too (max 3 per member)
    const token = randomBytes(16).toString("hex");
    await redis([["HSET", "ak", token, JSON.stringify({ n: name, at: Date.now() })]]);
    return { name, link: origin + "/?k=" + token };
  }
  return { count: (await rows()).length, invites: (await rows()).map((r) => ({ name: r.name, at: new Date(r.at).toISOString().slice(0, 10), link: origin + "/?k=" + r.token })) };
}

// v359: give an @ to every device that has a nickname (cu:<pid>) but no @ yet (hp:<pid>), so friends without account
// show « Name · @name » and can be found. Dry run by default (proposed @ only); &apply=1 reserves them:
// ah:<h> → "p:<pid>" (taken over by the account if that person signs in later), hp:<pid> → h, search index.
async function deviceHandles(apply) {
  const pids = [];
  let cur = "0", loops = 0;
  do {
    const [r] = await redis([["SCAN", cur, "MATCH", "cu:*", "COUNT", 500]]);
    cur = String(r[0]);
    for (const k of r[1]) pids.push(k.slice(3));
  } while (cur !== "0" && ++loops < 100);
  const out = [], skipped = [];
  for (const pid of pids.slice(0, 2000)) {
    const [name, has] = await redis([["GET", "cu:" + pid], ["GET", "hp:" + pid]]);
    if (has) { skipped.push({ name, handle: has, why: "has" }); continue; }
    if (!name) continue;
    let h = "";
    for (let i = 0; i < 4 && !h; i++) {
      const c = await suggest(name);
      if (!c || !handleOk(c)) break;
      if (!apply) { h = c; break; }
      const [ok] = await redis([["SET", "ah:" + c, "p:" + pid, "NX"]]);
      if (ok) h = c;
    }
    if (!h) { skipped.push({ name, why: "none" }); continue; }
    if (apply) { await redis([["SET", "hp:" + pid, h]]); try { await indexPerson(pid); } catch {} }
    out.push({ name, handle: h });
  }
  return { applied: apply, count: out.length, handles: out, skipped };
}

// v361: reported comments. &creports=1 lists them (hidden first); &cok=<key|id> puts one back online (reports cleared);
// &cdel=<key|id> deletes it for good; &cunban=<pid> lets an author comment again (his report count goes back to 0).
async function commentReports(q) {
  const one = async (ref) => {
    const [key, id] = String(ref).split("|");
    if (!/^[a-z0-9-]{1,60}$/.test(key || "") || !id) return null;
    const [raw] = await redis([["LRANGE", "c:" + key, 0, 99]]);
    const list = raw || [];
    const idx = list.findIndex((x) => { try { return JSON.parse(x).id === id; } catch { return false; } });
    return { key, id, list, idx, ref: key + "|" + id };
  };
  if (q.cok) {
    const f = await one(q.cok);
    if (!f || f.idx < 0) return { ok: false, error: "notfound" };
    const c = JSON.parse(f.list[f.idx]); delete c.h; delete c.rp;
    await redis([["LSET", "c:" + f.key, f.idx, JSON.stringify(c)], ["DEL", "crp:" + f.key + ":" + f.id], ["HDEL", "cmq", f.ref]]);
    return { ok: true, restored: f.ref };
  }
  if (q.cdel) {
    const f = await one(q.cdel);
    if (!f) return { ok: false, error: "notfound" };
    if (f.idx >= 0) await redis([["LSET", "c:" + f.key, f.idx, "__del__"], ["LREM", "c:" + f.key, 1, "__del__"]]);
    await redis([["DEL", "crp:" + f.key + ":" + f.id], ["HDEL", "cmq", f.ref]]);
    return { ok: true, deleted: f.ref };
  }
  if (q.cunban) {
    const pid = String(q.cunban);
    if (!/^[a-f0-9]{16}$/.test(pid)) return { ok: false, error: "pid" };
    await redis([["DEL", "cbk:" + pid], ["DEL", "cra:" + pid]]);
    return { ok: true, unbanned: pid };
  }
  const [all] = await redis([["HGETALL", "cmq"]]);
  const items = [];
  for (let i = 0; i + 1 < (all || []).length; i += 2) { try { items.push({ ref: all[i], ...JSON.parse(all[i + 1]) }); } catch {} }
  items.sort((a, b) => (b.hidden - a.hidden) || (b.at - a.at));
  return { count: items.length, items };
}
