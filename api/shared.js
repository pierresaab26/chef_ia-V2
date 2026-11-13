import { authOk, hasRedis, redis, overLimit, clean } from "./_lib.js";
import { createHash } from "node:crypto";
import { rank, recommended } from "./_score.js";
const pidOf = (owner) => createHash("sha256").update("circle|" + owner).digest("hex").slice(0, 16); // same as api/circle.js
// v364: @ of the author of a public copy (the publisher's pid is stored as `bp`; older copies: derived from the owner key)
const isMine = (d, owner) => !!(owner && d && d.pub && ((d.bp && d.bp === pidOf(owner)) || (d.o && d.o === owner)));
const handleOf = async (docs) => { const ps = docs.map((d) => (d && d.pub ? d.bp || (d.o ? pidOf(d.o) : "") : "")); const hs = ps.some(Boolean) ? await redis(ps.map((p) => ["GET", "hp:" + (p || "none")])) : []; return ps.map((p, i) => (p && hs[i]) || ""); };

// v129: shared recipes. The sender publishes a copy of the recipe ("s:<sid>") and gets a link /?s=<sid>.
// The friend opens the link: the recipe lands in his app with the SAME comment key, so both see the same comments.
// The first person who shares a comment key becomes its creator ("o:<key>"): only him can erase all its comments.
// v248: index « s:ck » (comment/rating key → {sid,t,l}) and counter « s:pop » (people who really shared it, POST {sid, hit:1}), read by the weekly menu (api/week-menu.js).
export default async function handler(req, res) {
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  if (!(await authOk(req, res))) return;

  const owner = clean(req.headers["x-owner"], 60);
  const q = req.query || {};
  const body = req.body && typeof req.body === "object" ? req.body : {};

  // v263: community search (GET ?q=mousse chocolat&lang=fr): the shared recipes whose title contains every word, best rated / most shared first.
  if (req.method === "GET" && q.q != null && q.sid == null) {
    if (await overLimit(req, "rl:cs:", 30)) return res.status(429).json({ error: "rate" });
    return res.status(200).json({ items: await searchShared(String(q.q), clean(q.lang, 5), 6, owner) });
  }
  const sid = String((req.method === "POST" ? body.sid : q.sid) || "");
  if (!/^[a-z0-9-]{8,64}$/.test(sid)) return res.status(400).json({ error: "key" });

  try {
    if (req.method === "GET") {
      const [raw] = await redis([["GET", "s:" + sid]]);
      if (!raw) return res.status(404).json({ error: "notfound" });
      const d = JSON.parse(raw);
      const bh = d.pub ? (await handleOf([d]))[0] : "";
      return res.status(200).json({ title: d.title, text: d.text, ck: d.ck, lang: d.lang, ph: d.ph || null, rs: d.rs || null, by: d.by || null, ...(d.pub ? { pub: 1, og: d.og || null, src: d.src || null, bh, ...(isMine(d, owner) ? { mine: 1 } : {}) } : {}) });
    }

    if (req.method === "POST") {
      if (body.hit) { // v248: the user really shared this copy (tap on Share): one count per person in « s:pop », read by the weekly menu
        if (!owner) return res.status(400).json({ error: "key" });
        if (await overLimit(req, "rl:s:", 20)) return res.status(429).json({ error: "rate" });
        const [raw] = await redis([["GET", "s:" + sid]]);
        let hck = ""; try { hck = JSON.parse(raw).ck || ""; } catch {}
        if (!/^[a-z0-9-]{1,60}$/.test(hck)) return res.status(404).json({ error: "notfound" });
        const [added] = await redis([["SADD", "s:sh:" + hck, owner]]);
        if (added) await redis([["ZINCRBY", "s:pop", "1", hck]]);
        return res.status(200).json({ ok: true });
      }
      const ck = String(body.ck || "");
      if (!owner || !/^[a-z0-9-]{1,60}$/.test(ck)) return res.status(400).json({ error: "key" });
      const text = clean(body.text, 20000);
      const title = clean(body.title, 120);
      if (!text || !title) return res.status(400).json({ error: "text" });
      if (await overLimit(req, "rl:s:", 20)) return res.status(429).json({ error: "rate" });

      const [old] = await redis([["GET", "s:" + sid]]);
      if (old) {
        let o = null;
        try { o = JSON.parse(old).o; } catch {}
        if (o && o !== owner) return res.status(403).json({ error: "forbidden" });
      }
      let ph = null;
      try {
        const p = body.ph;
        if (p && typeof p === "object" && JSON.stringify(p).length < 800) ph = p;
      } catch {}
      const d = { title, text, ck, lang: clean(body.lang, 5), ph, o: owner, ts: Date.now() };
      // v289: a recipe received from someone and shared again keeps its root copy (rs) and its author's nickname (by)
      if (/^[a-z0-9-]{8,64}$/.test(String(body.rs || "")) && body.rs !== sid) d.rs = String(body.rs);
      const by = clean(body.by, 24).replace(/[<>"]/g, "");
      if (by) d.by = by;
      // v290: a shared copy is NOT public: it is no longer indexed for the community search / weekly menu (index « pub:ck », filled only by a future explicit publication)
      const cmds = [["SET", "s:" + sid, JSON.stringify(d)], ["SETNX", "o:" + ck, owner]];
      await redis(cmds);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const [old] = await redis([["GET", "s:" + sid]]);
      if (!old) return res.status(200).json({ ok: true });
      let o = null;
      try { o = JSON.parse(old).o; } catch {}
      if (!owner || o !== owner) return res.status(403).json({ error: "forbidden" });
      const cmds = [["DEL", "s:" + sid]];
      try { const ck = JSON.parse(old).ck; const [m] = await redis([["HGET", PUB, ck]]); if (m && JSON.parse(m).sid === sid) cmds.push(["HDEL", PUB, ck]); } catch {}
      await redis(cmds);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "method" });
  } catch (e) {
    return res.status(502).json({ error: "storage" });
  }
}

// v290: public index = recipes their author PUBLISHED (palier 3, not built yet: empty for now). The old index « s:ck » listed every
// shared copy (even a recipe only opened, or put in a circle) and is erased once (flag « pub:mig »), with its backfill flag « s:bf ».
export const PUB = "pub:ck";
export async function dropOldIndex() {
  try { const [first] = await redis([["SET", "pub:mig", "1", "NX"]]); if (first) await redis([["DEL", "s:ck"], ["DEL", "s:bf"]]); } catch {}
}

const nz = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Words of the query (accents / case ignored, at least 2 letters, filler words dropped); every word must be part of the title (« choco » finds « chocolat », « mousse chocolat » finds « Mousse au chocolat »).
export function searchWords(q) {
  return nz(q).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !["au", "aux", "de", "du", "des", "la", "le", "les", "un", "une", "et", "en", "a", "the", "of", "al", "el", "con", "di", "da", "und", "mit"].includes(w)).slice(0, 6);
}

// v364: author name + @ on each result (so the app can open his profile)
async function addAuthors(items, owner) {
  try {
    const raws = await redis(items.map((o) => ["GET", "s:" + o.sid]));
    const docs = raws.map((r) => { try { return JSON.parse(r); } catch { return null; } });
    const hs = await handleOf(docs);
    return items.map((o, i) => ({ ...o, by: (docs[i] && docs[i].by) || "", bh: hs[i] || "", ...(isMine(docs[i], owner) ? { mine: 1 } : {}) })); /* v365: my own publication */
  } catch { return items; }
}

export async function searchShared(q, lang, max = 6, owner = "") {
  const words = searchWords(q);
  if (!words.length || words.join("").length < 3) return [];
  try {
    await dropOldIndex();
    const [flat] = await redis([["HGETALL", PUB]]);
    const hit = [], seen = new Set();
    for (let i = 0; i + 1 < (flat || []).length; i += 2) {
      try {
        const m = JSON.parse(flat[i + 1]);
        if (!m || !m.sid || !m.t || (m.l && lang && m.l !== lang)) continue;
        const nt = nz(m.t);
        if (!words.every((w) => nt.includes(w))) continue;
        hit.push({ ck: m.ck || flat[i], sid: m.sid, t: String(m.t).slice(0, 80), nt });
      } catch {}
    }
    const list = hit.slice(0, 40);
    if (!list.length) return [];
    const res = await redis(list.flatMap((c) => [["HGETALL", "r:" + c.ck], ["ZSCORE", "s:pop", c.ck], ["HLEN", "rc:" + c.ck]]));
    const out = list.map((c, x) => {
      const h = res[x * 3] || [], v = [];
      for (let i = 1; i < h.length; i += 2) { const n = Number(h[i]); if (n >= 1 && n <= 5) v.push(n); }
      const n = v.length, a = n ? v.reduce((p, r) => p + r, 0) / n : 0, sh = Number(res[x * 3 + 1]) || 0, cooked = Math.max(Number(res[x * 3 + 2]) || 0, n); // v315: people who cooked it (marked or rated)
      return { sid: c.sid, t: c.t, nt: c.nt, a: Math.round(a * 10) / 10, n, c: cooked, rec: recommended(a, n), score: rank(a, n, sh) };
    }).sort((p, r) => r.score - p.score).filter((o) => !seen.has(o.nt) && seen.add(o.nt)).slice(0, max).map(({ score, nt, ...o }) => o); // v314: one card per dish, the best-ranked variant first
    return await addAuthors(out, owner);
  } catch { return []; }
}
