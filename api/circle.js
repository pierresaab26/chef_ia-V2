import { createHash, randomBytes } from "node:crypto";
import { authOk, hasAccess, hasRedis, redis, overLimit, clean } from "./_lib.js";
import { notifyCircle, notifyOne, readNotes, markSeen } from "./_notify.js";
import { indexPerson, searchPeople } from "./_index.js"; // v358: find people by pseudo / @
import { isOffensive } from "./_words.js"; // v356
import authHandler, { sessionUid } from "./_auth.js"; // v354: « /api/auth » (accounts, e-mail sign-in) is served by this route too
import publishHandler from "./_publish.js"; // v293: « /api/publish » is served by this route (rewrite in vercel.json) to stay within 12 functions

// v287: identity (pseudo) and circle (community plan steps 6 and 7).
// A person = the device owner id sent as « x-owner » (never stored nor returned: only its hash « pid » is).
// Everyone has ONE circle: an invite link /?c=<code> (7 days) puts the two people in each other's circle.
// A recipe put in « Cercle » = its shared copy « s:<sid> » (api/shared.js) listed in the author's « cp:<pid> »;
// the circle feed = the recipes listed by the people of my circle.
// Redis: cu:<pid> pseudo · cf:<pid> set of circle pids · ci:<code> invite → pid (7 days) · cp:<pid> zset sid → time (max 100)
const MAX_CIRCLE = 50, MAX_POSTS = 100, FEED = 60, INVITE_TTL = 7 * 86400;
const ACCESS_MAX = 3; // v323: each person with access can give access to 3 friends (personal link in the shared "ak" table)
export const pidOf = (owner) => createHash("sha256").update("circle|" + owner).digest("hex").slice(0, 16);
export const cleanName = (s) => clean(s, 24).replace(/[<>"]/g, "").replace(/\s+/g, " ");

export default async function handler(req, res) {
  if (req.query && req.query.via === "pub") return publishHandler(req, res); // v293: /api/publish → /api/circle?via=pub
  if (req.query && req.query.via === "auth") return authHandler(req, res, pidOf); // v354: /api/auth → /api/circle?via=auth
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  // v329: ONE invitation link (/?c=<code>) = join my circle AND, for a friend who has no access yet, get in.
  // « redeem » is the only call allowed without access: someone who already has access gets nothing new (free, unlimited);
  // someone without access receives a personal token (table "ak") counted on the inviter's quota (ACCESS_MAX new people).
  if (req.method === "POST" && req.body && typeof req.body === "object" && req.body.act === "redeem") {
    try {
      if (await overLimit(req, "rl:rd:", 10)) return res.status(429).json({ error: "rate" });
      const code = String(req.body.code || "");
      if (!/^[a-z0-9]{8,16}$/.test(code)) return res.status(400).json({ error: "key" });
      if (await hasAccess(req)) return res.status(200).json({ ok: true, has: true });
      const [inviter] = await redis([["GET", "ci:" + code]]);
      if (!inviter) return res.status(404).json({ error: "notfound" });
      const [used] = await redis([["INCR", "ai:" + inviter]]);
      if (Number(used) > ACCESS_MAX) { await redis([["DECR", "ai:" + inviter]]); return res.status(409).json({ error: "limit" }); }
      const tok = randomBytes(16).toString("hex");
      const [who] = await redis([["GET", "cu:" + inviter]]);
      await redis([["HSET", "ak", tok, JSON.stringify({ n: "par " + (who || "?"), at: Date.now(), by: inviter })]]);
      return res.status(200).json({ ok: true, code: tok });
    } catch (e) { return res.status(502).json({ error: "storage" }); }
  }
  if (!(await authOk(req, res))) return;
  const owner = clean(req.headers["x-owner"], 60);
  if (!owner || owner.length < 8) return res.status(400).json({ error: "key" });
  if (await overLimit(req, "rl:ci:", 40)) return res.status(429).json({ error: "rate" });
  const me = pidOf(owner), q = req.query || {};
  const body = req.body && typeof req.body === "object" ? req.body : {};
  try {
    if (req.method === "GET") {
      if (q.feed) return res.status(200).json({ items: await feed(me) });
      if (q.notes) return res.status(200).json(await readNotes(me)); // v291: in-app notifications (🔔 on « Mon cercle »)
      if (q.live != null) { // v288: are these recipes (saved from my circle) still shared by someone of my circle?
        const sids = String(q.live).split(",").filter((x) => /^[a-z0-9-]{8,64}$/.test(x)).slice(0, 20);
        const [pids] = await redis([["SMEMBERS", "cf:" + me]]);
        const list = Array.isArray(pids) ? pids.slice(0, MAX_CIRCLE) : [];
        const live = {};
        if (sids.length && list.length) {
          const sc = await redis(sids.flatMap((sid) => list.map((p) => ["ZSCORE", "cp:" + p, sid])));
          sids.forEach((sid, i) => { live[sid] = sc.slice(i * list.length, (i + 1) * list.length).some((v) => v != null); });
          const raws = await redis(sids.map((sid) => ["GET", "s:" + sid])), rs = raws.map((r) => { try { return JSON.parse(r).rs || ""; } catch { return ""; } });
          const ok = await liveRoots(rs);
          sids.forEach((sid, i) => { if (rs[i] && !ok.has(rs[i])) live[sid] = false; }); // v289: the author took it back
        } else sids.forEach((sid) => { live[sid] = false; });
        return res.status(200).json({ live });
      }
      if (q.search != null) { // v358: people search (accounts with an @ only), signed-in users only
        if (!(await socialOk(req, me))) return res.status(401).json({ error: "session" });
        if (await overLimit(req, "rl:cs:", 30)) return res.status(429).json({ error: "rate" });
        const pids = (await searchPeople(q.search, 11)).filter((p) => p !== me).slice(0, 10);
        if (!pids.length) return res.status(200).json({ items: [] });
        const r = await redis(pids.flatMap((p) => [["GET", "cu:" + p], ["GET", "hp:" + p], ["SISMEMBER", "cf:" + me, p], ["HEXISTS", "cr:" + p, me], ["HEXISTS", "cr:" + me, p]]));
        const items = pids.map((p, i) => { const [n, h, inC, sent, asked] = r.slice(i * 5, i * 5 + 5);
          return h ? { pid: p, name: n || "", h, state: Number(inC) ? "in" : Number(asked) ? "asked" : Number(sent) ? "sent" : "" } : null; }).filter(Boolean);
        return res.status(200).json({ items });
      }
      try { await indexPerson(me); } catch {} // v358: accounts made before the index become findable
      return res.status(200).json(await whoami(me));
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method" });
    const act = String(body.act || "");

    if (act === "seen") { await markSeen(me); return res.status(200).json({ ok: true }); }
    if (act === "name") {
      const n = cleanName(body.name);
      if (!n) return res.status(400).json({ error: "name" });
      if (isOffensive(n)) return res.status(400).json({ error: "badword" }); // v356: offensive pseudo refused
      await redis([["SET", "cu:" + me, n]]);
      try { await indexPerson(me); } catch {} // v358
      return res.status(200).json({ ok: true, name: n });
    }
    if (act === "invite") {
      const code = randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12).padEnd(12, "0");
      await redis([["SET", "ci:" + code, me, "EX", String(INVITE_TTL)]]);
      return res.status(200).json({ code });
    }
    if (act === "access") { // v323: a member gives access to a friend (personal link, max 3 per person)
      const [used] = await redis([["INCR", "ai:" + me]]);
      if (Number(used) > ACCESS_MAX) { await redis([["DECR", "ai:" + me]]); return res.status(429).json({ error: "limit" }); }
      const tok = randomBytes(16).toString("hex");
      const [who] = await redis([["GET", "cu:" + me]]);
      await redis([["HSET", "ak", tok, JSON.stringify({ n: "par " + (who || "?"), at: Date.now(), by: me })]]);
      const origin = "https://" + String(req.headers["x-forwarded-host"] || req.headers.host || "chefia-v3.vercel.app");
      return res.status(200).json({ link: origin + "/?k=" + tok, left: ACCESS_MAX - Number(used) });
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
    // v358: circle REQUESTS (found by search): « cr:<target> » hash requester pid → time (30 days). Accepting makes the circle mutual.
    if (act === "request" || act === "accept" || act === "decline") {
      if (!(await socialOk(req, me))) return res.status(401).json({ error: "session" });
      const p = String(body.pid || "");
      if (!/^[a-f0-9]{16}$/.test(p) || p === me) return res.status(400).json({ error: "key" });
      const [myName, myH] = await redis([["GET", "cu:" + me], ["GET", "hp:" + me]]);
      const join = async () => {
        const [already, mine, theirs] = await redis([["SISMEMBER", "cf:" + me, p], ["SCARD", "cf:" + me], ["SCARD", "cf:" + p]]);
        if (!Number(already) && (Number(mine) >= MAX_CIRCLE || Number(theirs) >= MAX_CIRCLE)) return false;
        await redis([["SADD", "cf:" + me, p], ["SADD", "cf:" + p, me], ["HDEL", "cr:" + me, p], ["HDEL", "cr:" + p, me]]);
        await notifyOne(p, { k: "reqok", by: myName || "", bh: myH || "", p: me });
        return true;
      };
      if (act === "decline") { await redis([["HDEL", "cr:" + me, p]]); return res.status(200).json({ ok: true }); }
      if (act === "accept") {
        const [asked] = await redis([["HEXISTS", "cr:" + me, p]]);
        if (!Number(asked)) return res.status(404).json({ error: "notfound" });
        return (await join()) ? res.status(200).json({ ok: true, state: "in" }) : res.status(409).json({ error: "full" });
      }
      const [inC, theyAsked, hp] = await redis([["SISMEMBER", "cf:" + me, p], ["HEXISTS", "cr:" + me, p], ["GET", "hp:" + p]]);
      if (!hp) return res.status(404).json({ error: "notfound" }); // only accounts with an @ can be asked
      if (Number(inC)) return res.status(200).json({ ok: true, state: "in" });
      if (Number(theyAsked)) return (await join()) ? res.status(200).json({ ok: true, state: "in" }) : res.status(409).json({ error: "full" }); // both asked: done
      const day = new Date().toISOString().slice(0, 10);
      const [cnt] = await redis([["INCR", "crq:" + me + ":" + day], ["EXPIRE", "crq:" + me + ":" + day, "90000"]]);
      if (Number(cnt) > 20) return res.status(429).json({ error: "limit" }); // 20 requests a day
      const [was] = await redis([["HEXISTS", "cr:" + p, me]]);
      await redis([["HSET", "cr:" + p, me, String(Date.now())], ["EXPIRE", "cr:" + p, String(30 * 86400)]]);
      if (!Number(was)) await notifyOne(p, { k: "req", by: myName || "", bh: myH || "", p: me });
      return res.status(200).json({ ok: true, state: "sent" });
    }
    if (act === "post" || act === "unpost") {
      const sid = String(body.sid || "");
      if (!/^[a-z0-9-]{8,64}$/.test(sid)) return res.status(400).json({ error: "key" });
      if (act === "unpost") { await redis([["ZREM", "cp:" + me, sid]]); return res.status(200).json({ ok: true }); }
      const [raw] = await redis([["GET", "s:" + sid]]);
      let o = null; try { o = JSON.parse(raw).o; } catch {}
      if (!raw) return res.status(404).json({ error: "notfound" });
      if (o !== owner) return res.status(403).json({ error: "forbidden" }); // only the author puts his own copy in his circle
      let rs = ""; try { rs = JSON.parse(raw).rs || ""; } catch {}
      if (rs && !(await liveRoots([rs])).has(rs)) return res.status(409).json({ error: "gone" }); // v289: its author no longer shares it
      const [was] = await redis([["ZSCORE", "cp:" + me, sid]]);
      await redis([["ZADD", "cp:" + me, String(Date.now()), sid], ["ZREMRANGEBYRANK", "cp:" + me, "0", String(-MAX_POSTS - 1)]]);
      let t = ""; try { t = JSON.parse(raw).title || ""; } catch {}
      if (was == null && !body.quiet) await notifyCircle(me, { k: "circle", sid, t }); // v291: my circle is told once (not again on a re-post)
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "act" });
  } catch (e) {
    return res.status(502).json({ error: "storage" });
  }
}

// v289: a re-shared recipe (copy with « rs ») is only shown while its ROOT copy is still in its author's circle list:
// when the author sets it back to « Privée », every re-share disappears too. Returns a Set of the root sids still live.
export async function liveRoots(roots) {
  const list = [...new Set(roots.filter(Boolean))];
  if (!list.length) return new Set();
  const raws = await redis(list.map((r) => ["GET", "s:" + r]));
  const chk = [];
  list.forEach((r, i) => { try { const o = JSON.parse(raws[i]).o; if (o) chk.push([r, pidOf(o)]); } catch {} });
  if (!chk.length) return new Set();
  const sc = await redis(chk.map(([r, p]) => ["ZSCORE", "cp:" + p, r]));
  return new Set(chk.filter((x, i) => sc[i] != null).map((x) => x[0]));
}

// v359: search and requests need a signed-in account OR an @ on this device (given by the admin to friends without account).
async function socialOk(req, me) {
  if (await sessionUid(req)) return true;
  const [h] = await redis([["GET", "hp:" + me]]);
  return !!h;
}

async function whoami(me) {
  const [name, pids, used, h] = await redis([["GET", "cu:" + me], ["SMEMBERS", "cf:" + me], ["GET", "ai:" + me], ["GET", "hp:" + me]]);
  const list = Array.isArray(pids) ? pids.slice(0, MAX_CIRCLE) : [];
  const nh = list.length ? await redis(list.flatMap((p) => [["GET", "cu:" + p], ["GET", "hp:" + p]])) : []; // v355: + @handle (accounts only)
  const [rq] = await redis([["HGETALL", "cr:" + me]]); // v358: pending requests to me
  const rpids = []; for (let i = 0; i + 1 < (rq || []).length; i += 2) if (!list.includes(rq[i])) rpids.push(rq[i]);
  const rn = rpids.length ? await redis(rpids.slice(0, 30).flatMap((p) => [["GET", "cu:" + p], ["GET", "hp:" + p]])) : [];
  const reqs = rpids.slice(0, 30).map((p, i) => ({ pid: p, name: rn[i * 2] || "", h: rn[i * 2 + 1] || "" }));
  return { reqs, name: name || "", h: h || "", members: list.map((p, i) => ({ pid: p, name: nh[i * 2] || "", h: nh[i * 2 + 1] || "" })).sort((a, b) => a.name.localeCompare(b.name)), left: Math.max(0, ACCESS_MAX - Number(used || 0)) };
}

// Recipes put in « Cercle » by the people of my circle, newest first. A copy deleted by its author (s:<sid> gone) is dropped.
async function feed(me) {
  const [pids] = await redis([["SMEMBERS", "cf:" + me]]);
  const list = Array.isArray(pids) ? pids.slice(0, MAX_CIRCLE) : [];
  if (!list.length) return [];
  const out = await redis(list.flatMap((p) => [["ZREVRANGE", "cp:" + p, "0", "29", "WITHSCORES"], ["GET", "cu:" + p], ["GET", "hp:" + p]]));
  const posts = [];
  list.forEach((p, i) => {
    const z = out[i * 3] || [], by = out[i * 3 + 1] || "", bh = out[i * 3 + 2] || "";
    for (let k = 0; k + 1 < z.length; k += 2) posts.push({ sid: z[k], at: Number(z[k + 1]) || 0, by, bh, pid: p });
  });
  posts.sort((a, b) => b.at - a.at);
  const top = posts.slice(0, FEED);
  if (!top.length) return [];
  const raws = await redis(top.map((x) => ["GET", "s:" + x.sid]));
  const docs = top.map((x, i) => { try { return JSON.parse(raws[i]); } catch { return null; } });
  const live = await liveRoots(docs.map((d) => d && d.rs));
  return top.map((x, i) => {
    const d = docs[i];
    if (!d || (d.rs && !live.has(d.rs))) return null;
    return { sid: x.sid, t: String(d.title || "").slice(0, 120), l: d.lang || "", by: x.by, bh: x.bh, og: d.by || "", rs: d.rs || "", at: x.at, ph: d.ph && d.ph.t ? { t: d.ph.t } : null };
  }).filter(Boolean);
}
